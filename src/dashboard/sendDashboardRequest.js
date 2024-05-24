export default async function sendDashboardRequest(type, data = {}) {
  try {
    const response = await fetch('/', {
      method: "POST",
      body: JSON.stringify({type, ...data})
    });
    const obj = await response.json();
    return obj;
  } catch (err) {
    console.debug(sendDashboardRequest.name, 'Failed');
    console.debug({message: err.message});
    console.debug({stack: err.stack});
    console.debug({code: err.code});
    console.error(err);
    throw err;
  }
}