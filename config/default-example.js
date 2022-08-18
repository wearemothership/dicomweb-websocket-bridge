const config = {};

config.logDir = "./logs";

config.webserverPort = 5001;

config.websocketPort = 6001;

// this is the secret your remote client (e.g. dicomweb-proxy)
// needs to configure too, make sure to keep it secret
config.websocketToken = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

config.jwtPacsSecret = "YOUR SECRET HERE";

config.jwtPacsIssuer = "YOUR ISSUER HERE";

config.secure = "true";

config.withCors = "true";

config.certificateKeyPath = "c:/your/key/path";

config.certificatePath = "c:/your/cert/path";

config.certificateChainPath = "c:/your/chain/path";

config.certificateRevocationList = "c:/your/revocation/path";

module.exports = config;
