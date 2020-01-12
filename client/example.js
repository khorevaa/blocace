const Blocace = require('./index.js')

// initializing the default admin account
var blocace = Blocace.createFromPrivateKey('879aac33205b270c4a96109d41049a1fd37e595550f8a29271656c886a065c4f')

// encrypt and decrypt the seed
var encryptPrivKey = blocace.encryptPrivateKey('123456')
var decryptPrivKey = Blocace.decryptPrivateKey(encryptPrivKey, '123456')

console.log(blocace.wallet.getPrivateKey().toString('hex') === decryptPrivKey)

// user account payload
const accountPayload = {
  'dateOfBirth': '2018-10-01',
  'firstName': 'Hooper',
  'lastName': 'Vincent',
  'company': 'MITROC',
  'email': 'hoopervincent@mitroc.com',
  'phone': '+1 (849) 503-2756',
  'address': '699 Canton Court, Mulino, South Dakota, 9647',
  'publicKey': 'b0a303c71d99ad217c77af1e4d5b85e3ccc3e359d2ac9ff95e042fb0e0016e4d4c25482ba57de472c44c58f6fb124a0ab86613b0dcd1253a23d5ae00180854fa'
}

const collectionMappingPaylod = {
  'collection': 'new1',
  'fields': {
    'id': {'type': 'text'},
    'guid': {'type': 'text'},
    'age': {'type': 'number', 'encrypted': true},
    'registered': {'type': 'datetime'},
    'isActive': {'type': 'boolean'},
    'gender': {'type': 'text'},
    'name': {'type': 'text', 'encrypted': true},
    'location': {'type': 'geopoint'},
    'tags': {'type': 'text'}
  }
}

const permission = {
	"collectionsWrite": ["default", "new1"],
	"collectionsReadOverride": ["default", "collection2"]
}

const document = {
  'id': '5bf1d3fdf6fd4a5c4638f64e',
  'guid': 'f51b68c5-f274-4ce1-984f-b4fb4d618ff3',
  'isActive': false,
  'age': 28,
  'name': 'Carly Compton',
  'gender': 'male',
  'registered': '2015-09-18T12:59:51Z',
  'location': {
    'lon': 46.564666,
    'lat': 53.15213
  },
  'tags': [
    'incididunt',
    'dolore'
  ],
  'friends': [
    {
      'id': 0,
      'name': 'Jimenez Byers'
    },
    {
      'id': 1,
      'name': 'Gabriela Mayer'
    }
  ],
  'notExist': 'haha'
}

const queryPayload = {
  'size': 10,
  'from': 0,
  'query': {
    'match': 'Compton',
    'field': 'name'
  }
}

function timeout (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function start () {
  try {
    // get JWT
    const jwt = await blocace.getJWT()
    console.log(jwt)

    // register account
    const accountRes = await blocace.createAccount(accountPayload)
    console.log(accountRes.data.address)

    // get account
    const account = await blocace.getAccount(accountRes.data.address)
    console.log(account)

    // update account
    accountPayload.email = 'asd@asd.com'
    accountPayload.publicKey = '3ecc361be41aa06e0b2a9a7c65c1c750ad3ab503367180502e61c5f4b6f8e8b4e8d1d218042631546a5fe694e719b7a23f343a81fc25abcbd6f2f8c25d398d08'
    const accountUpdateRes = await blocace.updateAccount(accountPayload, accountRes.data.address)
    console.log(accountUpdateRes.data.message)

    // set account read / write permission
    const accountPermissionRes = await blocace.setAccountReadWrite(permission, accountRes.data.address)
    console.log(accountPermissionRes.data.message)

    // get account again
    const accountUpdated = await blocace.getAccount(accountRes.data.address)
    console.log(accountUpdated)
    
    // create collection
    const collectionCreationRes = await blocace.createCollection(collectionMappingPaylod)
    console.log(collectionCreationRes)

    // create the user account
    var blocaceUser = Blocace.createFromPrivateKey('277d271593d205c6078964c31fb393303efd76d5297906f60d2a7a7d7d12c99a')
    // get user JWT
    const jwtUser = await blocaceUser.getJWT()
    console.log(jwtUser)

    // add document
    const putDocRes = await blocaceUser.signAndPutDocument(document, 'new1')
    console.log(putDocRes)

    // wait for block to be generated
    await timeout(2000)

    // query the database
    const queryRes = await blocaceUser.query(queryPayload, 'new1')
    console.log(queryRes)

    // verify if the transaction is included in the block
    const verificationPassed = await blocaceUser.verifyTransaction(queryRes.hits[0]._blockId, queryRes.hits[0]._id)
    console.log(verificationPassed)

    // get block information
    const blockRes = await blocace.getBlockInfo(queryRes.hits[0]._blockId)
    console.log(blockRes)

    // get blockchain information
    const blockchainRes = await blocace.getBlockchainInfo(queryRes.hits[0]._blockId)
    console.log(blockchainRes)

    // get all collections
    const collectionsRes = await blocace.getCollections()
    console.log(collectionsRes)

    // get collection data schema
    const collectionRes = await blocace.getCollection('new1')
    console.log(JSON.stringify(collectionRes))

    // verify signature
    console.log(Blocace.verifySignature(queryRes.hits[0]._source, queryRes.hits[0]._signature, blocaceUser.wallet.getPublicKey().toString('hex')))
  } catch (error) {
    console.log(error.response)
  }
}

start()
