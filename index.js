import { createHelia } from "helia";
import { MemoryBlockstore } from "blockstore-core";
import { MemoryDatastore } from "datastore-core";
import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { bootstrap } from "@libp2p/bootstrap";
import { identify } from "@libp2p/identify";
import { unixfs } from "@helia/unixfs";

async function createNode() {
  // the blockstore is where we store the blocks that make up files
  const blockstore = new MemoryBlockstore();

  // application-specific data lives in the datastore
  const datastore = new MemoryDatastore();

  // libp2p is the networking layer that underpins Helia
  const libp2p = await createLibp2p({
    datastore,
    addresses: {
      listen: ["/ip4/127.0.0.1/tcp/0", "/ip4/172.**.***.**/tcp/0"], // here we add a multiaddr to listen to when we start the node. you can add your ip address here
    },
    transports: [tcp()],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    peerDiscovery: [
      bootstrap({
        list: [
          "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
          "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
          "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
          "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
          "/ip4/172.**.***.**/tcp/4001/p2p/12D3K*****************************", // here we add a peer to connect to when we start the node (you can add your node here by using "ipfs daemon" and then get the peer id by "ipfs id")
        ],
      }),
    ],
    services: {
      identify: identify(),
    },
  });

  return await createHelia({
    datastore,
    blockstore,
    libp2p,
  });
}

// Creating 3 nodes that you can play with

const nodeA = await createNode();
const nodeB = await createNode();
const nodeC = await createNode();

// get the multiaddrs of the nodes

const multiaddrsA = nodeA.libp2p.getMultiaddrs();
const multiaddrsC = nodeC.libp2p.getMultiaddrs();
const multiaddrsB = nodeB.libp2p.getMultiaddrs();

// now we will connect the nodeB and nodeC to nodeA. so that nodeA can be the intermediary node.
// feel free to change the order of the nodes and see if you can download files from node to another node.

await nodeB.libp2p.dial(multiaddrsA[0]); // connect the node to the first nodeB to nodeA
await nodeC.libp2p.dial(multiaddrsA[0]); // connect the node to the first nodeC to nodeA. You can comment this line if not needed

console.log(multiaddrsA);
console.log(multiaddrsB);

const fsB = unixfs(nodeB); // create a unixfs instance for nodeB this will be used to add the file to the nodeB
const encoder = new TextEncoder(); // create an encoder to convert the text to bytes
const bytes = encoder.encode(
  "Just a random string that i want to download in the other nodes"
); // convert the text to bytes
const cid = await fsB.addBytes(bytes); // add the bytes to the nodeB
console.log("Added file:", cid.toString()); // print the cid of the file that was added. we will use this to download the file in the other nodes

setTimeout(function () {
  //console.log(nodeA.libp2p.getPeers());
  console.log(nodeB.libp2p.getPeers());
  //console.log(nodeC.libp2p.getPeers());
}, 2000); // wait 2 seconds to see the peers of the nodes and then print them. normaly you should see the first node you added in bootstrap list in the peers list

const fsA = unixfs(nodeA);
const decoder = new TextDecoder();
let text = "";

// check if the file is downloaded in nodeA

setTimeout(async () => {
  nodeB.stop(); // stop the nodeB to see if the file can still be downloaded in nodeA because we connected nodeA to nodeB
  for await (const chunk of fsA.cat(cid)) {
    text += decoder.decode(chunk, { stream: true });
  }
  console.log("Downloaded file contents in NodeA:", text);
}, 5000); // wait 5 seconds to see if the file is downloaded in nodeA

// check if the nodeC can still download the file in nodeB from nodeA after nodeB is stopped because we connected nodeA to nodeC

const fsC = unixfs(nodeC);
const decoder2 = new TextDecoder();
let text2 = "";
setTimeout(async () => {
  for await (const chunk2 of fsC.cat(cid)) {
    text2 += decoder2.decode(chunk2, { stream: true });
  }
  console.log("Downloaded file contents in NodeC:", text2);
}, 10000); // wait 10 seconds to see if the file is downloaded in nodeC
