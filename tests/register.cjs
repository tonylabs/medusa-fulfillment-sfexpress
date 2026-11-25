// Regression tests are deliberately offline, including when a mock is missing.
const denyNetwork = () => { throw new Error('Network is forbidden in SF Express tests') }
globalThis.fetch = denyNetwork
require('node:http').request = denyNetwork
require('node:https').request = denyNetwork
require('node:net').Socket.prototype.connect = denyNetwork
process.env.TS_NODE_TRANSPILE_ONLY = 'true'
require('ts-node/register')
