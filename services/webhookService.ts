
export const sendReservationWebhook = async (reservationData: any) => {
  const WEBHOOK_URL = 'https://hook.us1.make.com/fz40xqepgb0yspmd18kfr9nn34w3ahgr';
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reservationData),
    });
    
    if (!response.ok) {
      console.warn('Webhook response was not ok', response.statusText);
    }
    
    return response;
  } catch (error) {
    console.error('Error sending reservation webhook:', error);
    throw error;
  }
};
