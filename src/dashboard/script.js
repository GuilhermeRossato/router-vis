import sendDashboardRequest from './sendDashboardRequest.js'

async function startDashboard() {
  const info = await sendDashboardRequest('info');
  console.log(info);
}

startDashboard().catch(err => { console.log(err); });