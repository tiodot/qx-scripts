require('../test.env');

// mocck request;
globalThis.$request = {
  headers: {
    vid: 'test_vid',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ key: 'value' }),
};

require('./login')