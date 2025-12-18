import { Configuration, PortfolioApi } from 'kalshi-typescript';

// IMPORTANT: Replace with your actual Kalshi API Key ID and private key path.
const config = new Configuration({
  apiKey: 'YOUR_API_KEY_ID', // Replace with your Kalshi API Key ID
  privateKeyPath: 'path/to/your/private-key.pem', // Path to your private key file
  // Alternatively, if you have the private key as a string:
  // privateKeyPem: '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----',
});

const portfolioApi = new PortfolioApi(config);

async function getPortfolio() {
  console.log('Fetching your Kalshi portfolio...');
  try {
    const { status, data } = await (portfolioApi as any).getBalance();
    console.log('Portfolio Status:', status);
    console.log('Portfolio Data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error fetching portfolio:', error);
  }
}

getPortfolio();
