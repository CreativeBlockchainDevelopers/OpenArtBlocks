const { PROVIDER_ADDRESS, CONTRACT_ADDRESS, ABI } = require('./config');
const { parse } = require('./parse_script');
const Web3 = require('web3');
const { readFileSync } = require('fs');

const HOST = process.env.HOST ?? `http://localhost:${process.env.PORT || 3333}`;

function traits(hash) {
  return [
    // generate metadata here
    {
      trait_type: 'Background',
      value: 'gray',
    },
  ];
}

// TODO manage multiple script types (contract.scriptType)
const HTML_p5 = readFileSync('template_p5.html').toString();
const HTML_svg = readFileSync('template_svg.html').toString();
const HTML = [HTML_p5, HTML_svg];

// SOME WEB3 STUFF TO CONNECT TO SMART CONTRACT
const provider = new Web3.providers.HttpProvider(PROVIDER_ADDRESS);
const web3infura = new Web3(provider);
const contract = new web3infura.eth.Contract(ABI, CONTRACT_ADDRESS);

function injectHTML(script, hash, html) {
  return html.replace('{{INJECT_SCRIPT_HERE}}', script).replace('{{INJECT_HASH_HERE}}', hash);
}

let infos = null;

async function refreshInfos() {
  const res = await contract.methods.script().call();
  const js = await parse(res.slice(1));
  infos = {
    string: js,
    html: HTML[Number(res[0])] ?? null,
    lastUpdated: new Date(),
  };
}
refreshInfos();

const TIMEOUT = 15 * 60 * 1000;
async function getScript() {
  if (!infos || new Date() - infos.lastUpdated > TIMEOUT) await refreshInfos();
  return infos.string;
}

async function getTokenHash(id) {

  if (tokenHashes[id] === undefined) {

    const totalSupply = await contract.methods.totalSupply().call();

    if (id >= totalSupply || id < 0) return null;

    tokenHashes[id] = await contract.methods.tokenHash(id).call();
  }
  return tokenHashes[id];

}


const tokenHashes = {};

const getMetadata = async (req, res) => {

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.sendStatus(404);

  const tokenHash = await getTokenHash(id);
  if (!tokenHash) return res.sendStatus(404);

  const attributes = traits(tokenHash)
  // CHECK OPENSEA METADATA STANDARD DOCUMENTATION https://docs.opensea.io/docs/metadata-standards
  let metadata = {
    name: 'CordialToken',
    description: 'Token description',
    tokenId: id,
    tokenHash,
    image: 'https://www.thefamouspeople.com/profiles/images/george-sand-5.jpg',
    external_url: HOST,
    attributes,
  };

  res.json(metadata);
}

const getLive = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.sendStatus(404);

  const tokenHash = await getTokenHash(id);
  if (!tokenHash) return res.sendStatus(404);

  const script = await getScript();
  const html = injectHTML(script, tokenHash, infos.html);

  return res.setHeader('Content-type', 'text/html').send(html);
}

module.exports = { getMetadata, getLive };