const environments = Object.freeze({
  production: Object.freeze({ name: 'production', apiUrl: 'https://api.vtaerp.com', hostname: 'localhost', displayName: 'VTA POS' }),
  sandbox: Object.freeze({ name: 'sandbox', apiUrl: 'https://zdbbps30oh7g8h05dpvxcgdx.2.24.112.55.sslip.io', hostname: 'sandbox.localhost', displayName: 'VTA POS Test' })
});

function iosBuildEnvironment(env = process.env) {
  const name = env.VTA_IOS_ENVIRONMENT ?? 'production';
  if (!Object.hasOwn(environments, name)) throw new Error('VTA_IOS_ENVIRONMENT must be production or sandbox.');
  return environments[name];
}

module.exports = { iosBuildEnvironment };
