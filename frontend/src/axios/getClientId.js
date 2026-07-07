export default function getClientId() {
  let clientId = localStorage.getItem('client_id');
  if (!clientId) {
    clientId = 'client_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('client_id', clientId);
  }
  return clientId;
}
