// Helper functions:
const base64StringToByteArray = (base64) => {
  return _encode(window.atob(base64));
};
const byteArrayToBase64String = (buffer) => {
  var bytes = new Uint8Array(buffer);
  var binary = '';
  for (var i=0; i<bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};
function _encode(str) {
  return new TextEncoder("utf-8").encode(str);
}

function _decode(buf) {
  return new TextDecoder("utf-8").decode(new Uint8Array(buf));
}



// RemoteTransformer:
const deriveKey = (salt) => {
  var randomValues=  Array(...crypto.getRandomValues(new Uint32Array(2)));
  var password = randomValues.map(c => c.toString(36)).join("");
  return crypto.subtle.
    importKey('raw', _encode(password), 'PBKDF2', false,  ['deriveKey'])
    .then((pwKey) => {
    var params = {
      name: 'PBKDF2',
      hash: 'SHA-1', // upgrade to SHA-2
      salt: salt,
      iterations: 5000
    };
    var algo = {name: "AES-GCM", length: 256 };
    var usages = ["encrypt", "decrypt"];
    return crypto.subtle.deriveKey(params, pwKey, algo, false, usages);
  });

};

const createTransformer = (aesKey, salt) => {
  const encode = (record) => {
    const cleartext = _encode(JSON.stringify(record));
    var nonce = crypto.getRandomValues(new Uint8Array(16));

    return window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey,
        cleartext)
      .then(ciphertext => {
      record.payload = JSON.stringify({
        ciphertext: _encode(new Uint8Array(ciphertext)),
        nonce: _encode(nonce),
        salt: _encode(salt),
      });
      return record;
    });
  };

  const decode = (record) => {
    console.log(record);
    const payloadStrings = JSON.parse(record.payload);
    const ciphertext = base64StringToByteArray(payloadStrings.ciphertext);
    const IV = base64StringToByteArray(payloadStrings.IV);

    return crypto.subtle.decrypt({ name: 'AES-CBC', iv: IV }, aesKey,
        ciphertext).then(recordArrayBuffer => {

      record.payload = JSON.parse(String.fromCharCode.apply(null,
          new Uint8Array(recordArrayBuffer)));

      return record;
    }, () => {
      record.undecryptable = true;
      return record;
    });
  };

  return {
    encode,
    decode
  };
};

// Kinto collection:
const createCollection = (transformer, dbPrefix) => {
  const kinto = new Kinto({
    dbPrefix: dbPrefix,
    remote: 'https://kinto.dev.mozaws.net/v1/',
    headers: {
      Authorization: 'Basic ' + btoa('public-demo:s3cr3t')
    }
  });

  return kinto.collection('foo', {
    remoteTransformers: [ transformer ]
  });
};

var coll1, coll2;
const prepare = () => {
  var salt = crypto.getRandomValues(new Uint8Array(8));
  return deriveKey(salt).then(aesKey => {
    return createTransformer(aesKey, salt);
  }).then(transformer => {
    // Create two fresh empty Kinto instances for testing:
    const prefix = new Date().getTime().toString();
    coll1 = createCollection(transformer, `${prefix}-1`);
    coll2 = createCollection(transformer, `${prefix}-2`);
  });
};

const syncUp = () => {
  // Use first Kinto instance to demonstrate encryption:
  return coll1.create({
    title: 'could be a filename or jsut a title',
    language: 'text/plain',
    text: 'very long paste text'
  }).then(() => {
    return coll1.sync();
  }).then(syncResults => {
    console.log('Sync up', syncResults);
  });
};

const syncDown = () => {
  // Use second Kinto instance to demonstrate decryption:
  return coll2.sync().then(syncResults => {
    console.log('Sync down', syncResults);
  });
};

const go = () => {
  console.log('Watch the Network tab!');
  return prepare().then(() => {
    return syncUp();
  }).then(() => {
    return syncDown();
  }).then(() => console.log('Success'), b => console.error('Failure', b));
};

go();
