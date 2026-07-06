import { RedisService } from '@libs/redis';
import { KafkaService } from '@libs/kafka';
import { logger } from '@libs/common';

export const redisService = new RedisService();
export const kafkaService = new KafkaService();

export let isKafkaAvailable = true;

export async function initKafka() {
  try {
    await kafkaService.getProducer();
    await kafkaService.ensureTopics(['social.notifications']);
    logger.info('API Gateway successfully connected to Kafka for social notifications.');
  } catch (err) {
    logger.warn('Kafka offline for API Gateway. Running notifications in fallback direct-write mode.', {
      error: (err as Error).message
    });
    setKafkaAvailable(false);
  }
}

export function setKafkaAvailable(val: boolean) {
  isKafkaAvailable = val;
}
