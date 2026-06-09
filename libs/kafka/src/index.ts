import { Kafka, Producer, Consumer, EachBatchPayload, Message as KafkaMessage, Partitioners } from 'kafkajs';
import { logger } from '@libs/common';

export class KafkaService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumers: Consumer[] = [];

  constructor() {
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    const clientId = process.env.KAFKA_CLIENT_ID || 'chat-app';

    logger.info('Initializing Kafka Client', { brokers, clientId });

    this.kafka = new Kafka({
      clientId,
      brokers,
      retry: {
        initialRetryTime: 300,
        retries: 5
      }
    });
  }

  // Ensure topics exist on the broker (preventing UNKNOWN_TOPIC_OR_PARTITION errors)
  async ensureTopics(topics: string[], numPartitions = 3): Promise<void> {
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      const existingTopics = await admin.listTopics();
      const topicsToCreate = topics.filter((t) => !existingTopics.includes(t));

      if (topicsToCreate.length > 0) {
        logger.info('Creating missing Kafka topics...', { topics: topicsToCreate });
        await admin.createTopics({
          topics: topicsToCreate.map((t) => ({
            topic: t,
            numPartitions,
            replicationFactor: 1, // Single broker replication factor
          })),
        });
        logger.info('Kafka topics created successfully');
      } else {
        logger.debug('All required Kafka topics already exist');
      }
    } catch (err) {
      logger.error('Failed to verify/create Kafka topics via Admin client', { error: (err as Error).message });
      throw err;
    } finally {
      await admin.disconnect();
    }
  }

  // Get or initialize Kafka Producer
  async getProducer(): Promise<Producer> {
    if (this.producer) return this.producer;

    // Use LegacyPartitioner to ensure key-based partitioning works predictably
    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner
    });

    await this.producer.connect();
    logger.info('Kafka Producer connected');
    return this.producer;
  }

  // Publish message to Kafka
  async publishMessage(topic: string, key: string, payload: any): Promise<void> {
    const producer = await this.getProducer();
    const message: KafkaMessage = {
      key,
      value: JSON.stringify(payload),
      timestamp: Date.now().toString(),
    };

    await producer.send({
      topic,
      messages: [message],
    });
  }

  // Create and run a Consumer Group
  async startConsumer(
    groupId: string,
    topic: string,
    onEachBatch: (payload: EachBatchPayload) => Promise<void>
  ): Promise<Consumer> {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });

    await consumer.run({
      autoCommit: false, // Manually commit offsets for reliability/idempotency
      eachBatch: async (batchPayload) => {
        const { batch, resolveOffset, heartbeat, commitOffsetsIfNecessary } = batchPayload;
        logger.info(`Consumer batch received`, { partition: batch.partition, messageCount: batch.messages.length });
        
        try {
          await onEachBatch(batchPayload);
          // Manually resolve offsets of successfully processed messages
          for (const message of batch.messages) {
            resolveOffset(message.offset);
          }
          await commitOffsetsIfNecessary();
          await heartbeat();
        } catch (error) {
          logger.error('Error processing Kafka consumer batch', { 
            error: (error as Error).message,
            topic: batch.topic,
            partition: batch.partition
          });
          // DLQ publication
          await this.handleFailedBatch(batchPayload, error as Error);
          throw error; // Re-throw so Kafka throws rebalance / crashes consumer for restart
        }
      }
    });

    this.consumers.push(consumer);
    logger.info(`Kafka Consumer started for group ${groupId} on topic ${topic}`);
    return consumer;
  }

  // DLQ Handling
  private async handleFailedBatch(batchPayload: EachBatchPayload, error: Error): Promise<void> {
    const { batch } = batchPayload;
    const dlqTopic = `${batch.topic}.dlq`;
    logger.warn(`Routing failed partition batch to DLQ`, { partition: batch.partition, dlqTopic });
    
    try {
      const producer = await this.getProducer();
      const dlqMessages: KafkaMessage[] = batch.messages.map(m => ({
        key: m.key,
        value: m.value,
        headers: {
          ...m.headers,
          'x-failed-error': Buffer.from(error.message),
          'x-failed-at': Buffer.from(new Date().toISOString()),
          'x-original-partition': Buffer.from(batch.partition.toString())
        }
      }));

      await producer.send({
        topic: dlqTopic,
        messages: dlqMessages,
      });

      logger.info(`Successfully sent failed messages to DLQ`, { count: dlqMessages.length, dlqTopic });
    } catch (dlqError) {
      logger.error('CRITICAL: Failed to publish messages to DLQ', { 
        error: (dlqError as Error).message 
      });
    }
  }

  // Graceful shutdown
  async close(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
    }
    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
    logger.info('Kafka connections closed');
  }
}
