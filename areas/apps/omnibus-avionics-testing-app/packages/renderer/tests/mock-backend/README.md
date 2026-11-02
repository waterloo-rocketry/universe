# Mock Omnibus Server

Simple Socket.IO server for testing Omnibus connection functionality.

## Technical Details

### Server Configuration

- **Technology**: Node.js with socket.io
- **Port**: 8081
- **CORS**: Enabled for all origins

### Running the Server

\`\`\`bash
cd packages/renderer/tests/mock-backend
npm install
npm start
\`\`\`

### Testing Connection

<!-- markdownlint-disable MD034 -->

\`\`\`javascript
// In browser console
const socket = io('http://localhost:8081');

socket.on('connect', () => {
console.log('Connected to mock server');
});

socket.on('connect_error', (err) => {
console.log('Connection error:', err);
});
\`\`\`

<!-- markdownlint-enable MD034 -->

## Connection Logging

The server logs when clients connect and disconnect:

- `Client connected: <socket-id>`
- `Client disconnected: <socket-id>`
