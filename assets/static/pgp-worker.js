self.window = { crypto: self.crypto }; // to make UMD bundles work

importScripts('openpgp.min.js');
var openpgp = window.openpgp;

var decryptedAllPrivKeys = {};
var decryptedSecureMsgPrivKeyObj;

var decryptedPrivateKeyForImport;

onmessage = async function (event) {
  if (event.data.clear) {
    decryptedAllPrivKeys = {};
  } else if (event.data.encrypt) {
    if (event.data.pgpEncryptionTypeForExternal === null) {
      encryptContent(event.data.mailData.content, event.data.publicKeys).then(content => {
        encryptContent(event.data.mailData.subject, event.data.publicKeys).then(subject => {
          postMessage({ encryptedContent: { content, subject }, encrypted: true, callerId: event.data.callerId });
        });
      });
    } else {
      encryptContent(event.data.mailData.content, event.data.publicKeys).then(content => {
        postMessage({ encryptedContent: { content, subject: event.data.mailData.subject }, encrypted: true, callerId: event.data.callerId });
      });
    }
  } else if (event.data.encryptAttachment) {
    encryptAttachment(event.data.fileData, event.data.publicKeys).then(content => {
      postMessage({ encryptedContent: content, encryptedAttachment: true, attachment: event.data.attachment });
    });
  } else if (event.data.encryptForPGPMime) {
    // Encryption for PGP/MIME message
    encryptContent(event.data.mailData.subject, event.data.publicKeys).then(subject => {
      postMessage({ encryptedContent: { content, subject }, encrypted: true, callerId: event.data.callerId });
    });
  } else if (event.data.decryptAttachment) {
    decryptAttachment(event.data.fileData, decryptedAllPrivKeys[event.data.mailboxId]).then(content => {
      postMessage({
        decryptedContent: content,
        decryptedAttachment: true,
        fileInfo: event.data.fileInfo,
        subjectId: event.data.subjectId,
      });
    });
  } else if (event.data.encryptSecureMessageReply) {
    encryptContent(event.data.content, event.data.publicKeys).then(data => {
      postMessage({ encryptedContent: data, encryptSecureMessageReply: true });
    });
  } else if (event.data.generateKeys) {
    generateKeys(event.data.options).then(data => {
      validateKeysGenerated(data).then(validate => {
        if (validate) {
          postMessage({
            generateKeys: true,
            keys: data,
            callerId: event.data.callerId,
            forEmail: !!event.data.forEmail,
            subjectId: event.data.subjectId,
          });
        } else {
          postMessage({
            generateKeys: true,
            errorMessage: 'Failed to generate keys.',
            error: true,
            callerId: event.data.callerId,
            forEmail: !!event.data.forEmail,
            options: event.data.options,
            subjectId: event.data.subjectId,
          });
        }
      });
    });
  } else if (event.data.decryptSecureMessageKey) {
    decryptedSecureMsgPrivKeyObj = (await openpgp.key.readArmored(event.data.privKey)).keys[0];
    decryptedSecureMsgPrivKeyObj
      .decrypt(event.data.password)
      .then(res => {
        postMessage({ decryptSecureMessageKey: true, decryptedKey: decryptedSecureMsgPrivKeyObj });
      })
      .catch(error => {
        postMessage({ decryptSecureMessageKey: true, error: error.message });
      });
  } else if (event.data.decryptSecureMessageContent) {
    if (!event.data.mailData) {
      postMessage({ decryptedContent: '', decryptSecureMessageContent: true });
    } else {
      decryptWithPassword(event.data.mailData.content, event.data.password).then(content => {
        decryptWithPassword(event.data.mailData.subject, event.data.password).then(subject => {
          postMessage({ mailData: { content, subject }, decryptSecureMessageContent: true, errorMessage: '' });
        });
      })
      .catch(error => {
        postMessage({ mailData: { content: '', subject: '' }, decryptSecureMessageContent: true, errorMessage: 'Password is incorrect' });
      });
    }
  } else if (event.data.decryptSecureMessageAttachment) {
    decryptAttachmentWithPassword(event.data.fileData, event.data.password).then(content => {
      postMessage({
        decryptedContent: content,
        decryptedSecureMessageAttachment: true,
        fileInfo: event.data.fileInfo,
        subjectId: event.data.subjectId,
      });
    });
  } else if (event.data.decryptAllPrivateKeys) {
    if (event.data.privateKeys) {
      await decryptAllPrivateKeys(event.data);
    }
    postMessage({ keys: decryptedAllPrivKeys, decryptAllPrivateKeys: true });
  } else if (event.data.decrypt) {
    if (!event.data.mailboxId) {
      postMessage({
        decryptedContent: {},
        decrypted: true,
        callerId: event.data.callerId,
        subjectId: event.data.subjectId,
      });
    } else {
      if (decryptedAllPrivKeys[event.data.mailboxId]) {
        decryptContentProcess(event.data);
      }
    }
  } else if (event.data.decryptPasswordEncryptedContent) {
    if (!event.data.mailData) {
      postMessage({ decryptedContent: {}, decrypted: true, callerId: event.data.callerId });
    } else {
      decryptWithPassword(event.data.mailData.content, event.data.password)
        .then(content => {
          decryptWithPassword(event.data.mailData.subject, event.data.password).then(subject => {
            decryptWithPassword(event.data.mailData.content_plain, event.data.password).then(content_plain => {
              postMessage({
                decryptedContent: { content, subject, content_plain },
                decrypted: true,
                callerId: event.data.callerId,
                isDecryptingAllSubjects: false,
                subjectId: event.data.subjectId,
              });
            });
          });
        })
        .catch(() => {
          postMessage({
            decryptedContent: { content: '', subject: '', content_plain: '' },
            decrypted: true,
            callerId: event.data.callerId,
            isDecryptingAllSubjects: false,
            subjectId: event.data.subjectId,
            error: true,
          });
        });
    }
  } else if (event.data.changePassphrase) {
    if (event.data.deleteData) {
      generateNewKeys(event.data.mailboxes, event.data.passphrase, event.data.username, 'ECC').then(data => {
        postMessage({ ...data, subjectId: event.data.subjectId, deleteData: true });
      }).catch(() => {
        postMessage({ subjectId: event.data.subjectId, error: true, deleteData: true });
      });
    } else {
      changePassphrase(event.data.passphrase).then(data => {
        postMessage({ ...data, subjectId: event.data.subjectId });
      }).catch(error => {
        postMessage({ ...error, subjectId: event.data.subjectId, error: true });
      });
    }
  } else if (event.data.revertPassphrase) {
    changePassphrase(event.data.passphrase).then(data => {});
  } else if (event.data.encryptJson) {
    encryptContent(event.data.content, event.data.publicKeys).then(content => {
      postMessage({ ...event.data, encryptedContent: content });
    });
  } else if (event.data.decryptJson) {
    if (event.data.isContactsArray) {
      const promises = [];
      for (let i = 0; i < event.data.contacts.length; i++) {
        promises.push(
          decryptContent(event.data.contacts[i].encrypted_data, decryptedAllPrivKeys[event.data.mailboxId]),
        );
      }
      Promise.all(promises).then(data => {
        for (let i = 0; i < event.data.contacts.length; i++) {
          event.data.contacts[i] = {
            ...event.data.contacts[i],
            ...JSON.parse(data[i]),
            encrypted_data: null,
            is_encrypted: false,
          };
        }
        postMessage({ ...event.data });
      });
    } else if (event.data.isContact) {
      decryptContent(event.data.content, decryptedAllPrivKeys[event.data.mailboxId]).then(content => {
        postMessage({ ...event.data, content });
      });
    }
  } else if (event.data.encryptWithPassword) {
    encryptWithPassword(event.data.mailData.content, event.data.password).then(content => {
      encryptWithPassword(event.data.mailData.subject, event.data.password).then(subject => {
        postMessage({ encryptedContent: { content, subject }, encrypted: true, callerId: event.data.callerId });
      });
    });
  } else if (event.data.encryptAttachmentWithPassword) {
    encryptAttachmentWithPassword(event.data.fileData, event.data.password).then(content => {
      postMessage({ encryptedContent: content, encryptedAttachment: true, attachment: event.data.attachment });
    });
  } else if (event.data.getKeyInfoFromPublicKey) {
    getKeyInfoFromPublicKey(event.data.publicKey)
      .then(keyInfo => {
        postMessage({
          getKeyInfoFromPublicKey: true,
          keyInfo,
          subjectId: event.data.subjectId,
        });
      })
      .catch(e => {
        postMessage({
          getKeyInfoFromPublicKey: true,
          errorMessage: e,
          error: true,
          subjectId: event.data.subjectId,
        });
      });
  } else if (event.data.generateKeysForEmail) {
    generateKeys(event.data.options)
      .then(data => {
        validateKeysGenerated(data).then(valide => {
          if (valide) {
            postMessage({
              generateKeysForEmail: true,
              keys: data,
              subjectId: event.data.subjectId,
            });
          } else {
            postMessage({
              generateKeysForEmail: true,
              errorMessage: 'Failed to generate keys.',
              error: true,
              subjectId: event.data.subjectId,
              options: event.data.options,
            });
          }
        });
      })
      .catch(e => {
        postMessage({
          generateKeysForEmail: true,
          errorMessage: e,
          error: true,
          subjectId: event.data.subjectId,
        });
      });
  } else if (event.data.encryptForPGPMimeContent) {
    encryptContent(event.data.pgpMimeData, event.data.publicKeys).then(data => {
      postMessage({
        data,
        encryptedForPGPMimeContent: true,
        draftId: event.data.draftId,
       });
    });
  } else if (event.data.decryptPrivateKey) {
    parsePrivateKey(event.data).then(data => {
      if (data) {
        postMessage({
          data,
          decryptedPrivateKey: true,
          subjectId: event.data.subjectId,
        });
      } else {
        postMessage({
          decryptedPrivateKey: true,
          error: true,
          errorMessage: 'Failed to import private key',
          subjectId: event.data.subjectId,
        });
      }
    }).catch(errorMessage => {
      postMessage({
        decryptedPrivateKey: true,
        error: true,
        errorMessage,
        subjectId: event.data.subjectId,
      });
    });
  } else if (event.data.validatePrivateKey) {
    validatePrivateKey(event.data).then(data => {
      if (data) {
        postMessage({
          data,
          validatedPrivateKey: true,
          subjectId: event.data.subjectId,
        });
      } else {
        postMessage({
          validatedPrivateKey: true,
          error: true,
          errorMessage: 'Invalid Private Key ',
          subjectId: event.data.subjectId,
        });
      }
    }).catch(errorMessage => {
      postMessage({
        validatedPrivateKey: true,
        error: true,
        errorMessage: 'Invalid Private Key',
        subjectId: event.data.subjectId,
      });
    });
  } else if (event.data.encryptPrivateKey) {
    encryptPrivateKey(event.data).then(data => {
      if (data) {
        postMessage({
          data,
          encryptedPrivateKey: true,
          subjectId: event.data.subjectId,
        });
      } else {
        postMessage({
          encryptedPrivateKey: true,
          error: true,
          errorMessage: 'Failed to encrypt private key ',
          subjectId: event.data.subjectId,
        });
      }
    }).catch(errorMessage => {
      postMessage({
        encryptedPrivateKey: true,
        error: true,
        errorMessage: 'Invalid Private Key',
        subjectId: event.data.subjectId,
      });
    });
  }
};

async function encryptPrivateKey(data) {
  try {
    const { privateKey, password, passphrase } = data;
    let armoredPrivateKey = (await openpgp.key.readArmored(privateKey)).keys[0];
    if (!armoredPrivateKey) {
      return Promise.reject('Invalid Private Key');
    }
    await armoredPrivateKey.decrypt(passphrase);
    await armoredPrivateKey.encrypt(password);
    // At this point, decryptedPrivateKey is actually armoredPrivateKey === encryptedPrivateKey
    const decryptedPublicKey = armoredPrivateKey.toPublic();
    const fingerprint = decryptedPublicKey.getFingerprint();
    const private_key = armoredPrivateKey.armor();
    const public_key = decryptedPublicKey.armor();
    const algorithmInfo = decryptedPublicKey.getAlgorithmInfo();
    return Promise.resolve({ public_key, private_key, fingerprint, algorithmInfo });
  } catch (e) {
    return Promise.reject('Failed to encrypt key');
  };
}

async function parsePrivateKey(data) {
  const passphrase = data.passphrase;
  if (data.privateKey && data.privateKey.indexOf('-----BEGIN PGP PRIVATE KEY BLOCK-----') === 0) {
    try {
      let armoredPrivateKey = (await openpgp.key.readArmored(data.privateKey)).keys[0];
      if (!armoredPrivateKey) {
        return Promise.reject('Invalid Private Key');
      }
      await armoredPrivateKey.decrypt(passphrase);
      if (armoredPrivateKey.keyPacket.isEncrypted) {
        return Promise.reject('Failed to import private key');
      } else {
        return Promise.resolve(armoredPrivateKey);
      }
    } catch (e) {
      return Promise.reject('Failed to import private key');
    };
  } else {
    return Promise.reject('Invalid Private Key');
  }
}

async function validatePrivateKey(data) {
  if (data.privateKey && data.privateKey.indexOf('-----BEGIN PGP PRIVATE KEY BLOCK-----') === 0) {
    try {
      let armoredPrivateKey = (await openpgp.key.readArmored(data.privateKey)).keys[0];
      if (!armoredPrivateKey) {
        return Promise.reject('Invalid Private Key');
      }
      return Promise.resolve({ fingerprint: armoredPrivateKey.getFingerprint() });
    } catch (e) {
      return Promise.reject('Failed to import private key');
    };
  } else {
    return Promise.reject('Invalid Private Key');
  }
}

function isPGPEncrypted(content) {
  return content && content.indexOf('-----BEGIN PGP MESSAGE-----') === 0 ? true : false;
}

function generateKeys(options) {
  return openpgp.generateKey(options).then(async key => {
    return {
      public_key: key.publicKeyArmored,
      private_key: key.privateKeyArmored,
      fingerprint: (await openpgp.key.readArmored(key.publicKeyArmored)).keys[0].primaryKey.getFingerprint(),
    };
  });
}

async function validateKeysGenerated(data) {
  if (
    data.private_key && data.private_key.indexOf('-----BEGIN PGP PRIVATE KEY BLOCK-----') === 0 &&
    data.public_key && data.public_key.indexOf('-----BEGIN PGP PUBLIC KEY BLOCK-----') === 0
  ) {
    try {
      const armoredPrivateKey = (await openpgp.key.readArmored(data.private_key)).keys[0];
      if (!armoredPrivateKey) {
        return false;
      }
      const armoredPublicKey = (await openpgp.key.readArmored(data.public_key)).keys[0];
      if (!armoredPublicKey) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    };
  } else {
    return false;
  }
}

/**
 * This is using for only change password and delete key flag CASE
 * @param mailboxes
 * @param password
 * @param username
 * @param key_type
 * @return {Promise<{changePassphrase: boolean, keys: []}>}
 */
async function generateNewKeys(mailboxes, password, username, key_type) {
  const newKeys = {};
  try {
    for (let i = 0; i < mailboxes.length; i++) {
      let options = {};
      if (key_type === 'ECC') {
        options = {
          userIds: [{ name: username, email: mailboxes[i].email }],
          curve: "ed25519",
          passphrase: password,
        };
      } else if (key_type === 'RSA4096') {
        options = {
          userIds: [{ name: username, email: mailboxes[i].email }],
          numBits: 4096,
          passphrase: password,
        };
      } else {
        options = {
          userIds: [{ name: username, email: mailboxes[i].email }],
          numBits: 2048,
          passphrase: password,
        };
      }
      const keys = await generateKeys(options);
      newKeys[mailboxes[i].id] = [keys];
    }
    return Promise.resolve({ keys: newKeys, changePassphrase: true });
  } catch(error) {
    return Promise.reject({ changePassphrase: true, error: true });
  }
}

// TODO - Should be updated with decryptedAllKey
async function changePassphrase(passphrase) {
  let keysMap = {};
  for (const mailboxId in decryptedAllPrivKeys) {
    let keys = [];
    let keysByMailbox = Object.assign(decryptedAllPrivKeys[mailboxId]);
    for (let i = 0; i < keysByMailbox.length; i++) {
      let tmpKey = keysByMailbox[i];
      await tmpKey.private_key.encrypt(passphrase);
      keys.push({
        private_key: tmpKey.private_key.armor(),
        is_primary: tmpKey.is_primary,
        mailbox_key_id: tmpKey.mailbox_key_id
      });

    }
    keysMap[mailboxId] = keys;
  }
  return { keys: keysMap, changePassphrase: true };
}

async function encryptContent(data, publicKeys) {
  if (!data) {
    return Promise.resolve(data);
  }
  const pubkeys = await Promise.all(
    publicKeys.map(async key => {
      return (await openpgp.key.readArmored(key)).keys[0];
    }),
  );
  const options = {
    message: openpgp.message.fromText(data),
    publicKeys: pubkeys,
  };
  return openpgp.encrypt(options)
    .then(payload => {
      return payload.data;
    });
}

async function decryptContent(data, privateKeyObj) {
  if (!data) {
    return Promise.resolve(data);
  }
  try {
    const options = {
      message: await openpgp.message.readArmored(data),
      privateKeys: privateKeyObj.map(obj => obj.private_key),
    };
    return openpgp.decrypt(options).then(payload => {
      return payload.data;
    });
  } catch (e) {
    return Promise.reject(data);
  }
}

async function encryptAttachment(data, publicKeys) {
  if (!data) {
    return Promise.resolve(data);
  }
  const pubkeys = await Promise.all(
    publicKeys.map(async key => {
      return (await openpgp.key.readArmored(key)).keys[0];
    }),
  );
  const options = {
    message: await openpgp.message.fromBinary(data),
    publicKeys: pubkeys,
  };
  return openpgp.encrypt(options).then(payload => {
    return payload.data;
  });
}

async function decryptAttachment(data, privateKeyObj) {
  const tmpDecodedData = atob(data);
  const isArmored = isPGPEncrypted(tmpDecodedData);
  if (!data) {
    return Promise.resolve(data);
  }
  try {
    const options = {
      message: isArmored
        ? await openpgp.message.readArmored(tmpDecodedData)
        : await openpgp.message.read(openpgp.util.b64_to_Uint8Array(data)),
      privateKeys: privateKeyObj.map(obj => obj.private_key),
      format: 'binary',
    };
    return openpgp.decrypt(options).then(payload => {
      return payload.data;
    });
  } catch (e) {
    return Promise.resolve(data);
  }
}

async function decryptAttachmentWithPassword(data, password) {
  const tmpDecodedData = atob(data);
  const isArmored = tmpDecodedData.includes('-----BEGIN PGP MESSAGE-----') ? true : false;
  if (!data) {
    return Promise.resolve(data);
  }
  try {
    const options = {
      message: isArmored
        ? await openpgp.message.readArmored(tmpDecodedData)
        : await openpgp.message.read(openpgp.util.b64_to_Uint8Array(data)),
      passwords: [password],
      format: 'binary',
    };
    return openpgp.decrypt(options).then(payload => {
      return payload.data;
    });
  } catch (e) {
    return Promise.resolve(data);
  }
}

async function encryptWithPassword(data, password) {
  if (!data) {
    return Promise.resolve(data);
  }
  const options = {
    message: openpgp.message.fromText(data),
    passwords: [password],
    armor: true,
  };
  return openpgp.encrypt(options).then(payload => {
    return payload.data;
  });
}

async function decryptWithPassword(data, password) {
  if (!data || !password) {
    return Promise.resolve(data);
  }
  try {
    const options = {
      message: await openpgp.message.readArmored(data),
      passwords: [password],
    };
    return openpgp.decrypt(options).then(payload => {
      return payload.data;
    });
  } catch (e) {
    return Promise.resolve(data);
  }
}

async function encryptAttachmentWithPassword(data, password) {
  if (!data) {
    return Promise.resolve(data);
  }
  const options = {
    message: await openpgp.message.fromBinary(data),
    passwords: [password],
    armor: true,
  };
  return openpgp.encrypt(options).then(payload => {
    return payload.data;
  });
}

async function getKeyInfoFromPublicKey(publicKey) {
  if (!publicKey) {
    return Promise.resolve(publicKey);
  }
  try {
    const pubKey = (await openpgp.key.readArmored(publicKey)).keys[0];
    if (!pubKey) {
      return Promise.reject('Invalid public key');
    }
    const fingerprint = pubKey.primaryKey.getFingerprint();
    const keyId = pubKey.primaryKey.getKeyId().toHex();
    // Getting user email, so that this public key is really for the selected contact
    const users = pubKey.users;
    let emails = [];
    users.forEach(user => {
      if (user.userId && user.userId.email) {
        emails = [...emails, user.userId.email];
      }
    });

    const creationTime = pubKey.primaryKey.getCreationTime();
    const algorithmInfo = pubKey.primaryKey.getAlgorithmInfo();
    const keyInfo = {
      fingerprint,
      keyId,
      emails,
      creationTime,
      algorithmInfo,
    };
    return Promise.resolve(keyInfo);
  } catch (e) {
    return Promise.reject(publicKey);
  }
}

async function decryptAllPrivateKeys(data) {
  let keyMap = data.privateKeys;
  let mailboxIds = Object.keys(keyMap);
  for (let i = 0; i < mailboxIds.length; i++) {
    let decryptedPrivateKeyAry = [];
    let keys = keyMap[mailboxIds[i]];
    for (let index = 0; index < keys.length; index++) {
      try {
        const key = keys[index];
        let tmpKey = (await openpgp.key.readArmored(key.private_key)).keys[0];
        await tmpKey.decrypt(data.user_key);
        decryptedPrivateKeyAry.push({
          private_key: tmpKey,
          is_primary: key.is_primary,
          mailbox_key_id: key.mailbox_key_id,
        });
      } catch (e) {}
    }
    decryptedAllPrivKeys[mailboxIds[i]] = decryptedPrivateKeyAry;
  }
}

/**
 * Start to decrypt SecureContent - Content, IncomingHeaders, Subject, Content_plain
 * This function would decrypt only content and jump into Decrypting Incoming Headers function,
 * Even though decryption got success or failed.
 * @param data
 */
function decryptContentProcess(data) {
  let isDecryptedError = false;
  let decryptedContent = {};
  if (!isPGPEncrypted(data.mailData.content)) {
    if (!data.mailData.content) {
      decryptedContent = { ...decryptedContent, content: '(Empty Content)' };
      decryptIncomingHeadersProcess(data, decryptedContent, isDecryptedError);
      return;
    }
    isDecryptedError = true;
    decryptedContent = { ...decryptedContent, content: data.mailData.content };
    decryptIncomingHeadersProcess(data, decryptedContent, isDecryptedError);
  } else if (data.mailData.content) {
    decryptContent(data.mailData.content, decryptedAllPrivKeys[data.mailboxId])
      .then(content => {
        decryptedContent = { ...decryptedContent, content };
        decryptIncomingHeadersProcess(data, decryptedContent, isDecryptedError);
      })
      // Content decryption error catch
      .catch((error) => {
        isDecryptedError = true;
        decryptedContent = { ...decryptedContent, content: data.mailData.content };
        decryptIncomingHeadersProcess(data, decryptedContent, isDecryptedError);
      });
  }
}

/**
 * Decrypt IncomingHeaders, called by decryptContentProcess
 * @param data
 * @param decryptedContent
 * @param isDecryptedError
 */
function decryptIncomingHeadersProcess(data, decryptedContent, isDecryptedError) {
  if (!isPGPEncrypted(data.mailData.incomingHeaders)) {
    if (!data.mailData.incomingHeaders) {
      decryptedContent = { ...decryptedContent, incomingHeaders: "" };
      decryptSubjectProcess(data, decryptedContent, isDecryptedError);
      return;
    }
    isDecryptedError = true;
    decryptedContent = { ...decryptedContent, incomingHeaders: data.mailData.incomingHeaders };
    decryptSubjectProcess(data, decryptedContent, isDecryptedError);
  } else {
    decryptContent(data.mailData.incomingHeaders, decryptedAllPrivKeys[data.mailboxId])
      .then(incomingHeaders => {
        decryptedContent = { ...decryptedContent, incomingHeaders };
        decryptSubjectProcess(data, decryptedContent, isDecryptedError);
      })
      // IncomingHeaders decryption error catch
      .catch((error) => {
        isDecryptedError = true;
        decryptedContent = { ...decryptedContent, incomingHeaders: data.mailData.incomingHeaders };
        decryptSubjectProcess(data, decryptedContent, isDecryptedError);
      });
  }
}

/**
 * Decrypt Subject, called by decryptIncomingHeadersProcess
 * isSubjectDecryptedError would be treated especially, because it would decide to display subject or not.
 * @param data
 * @param decryptedContent
 * @param isDecryptedError
 */
function decryptSubjectProcess(data, decryptedContent, isDecryptedError) {
  if (!isPGPEncrypted(data.mailData.subject)) {
    if (!data.mailData.subject) {
      decryptedContent = { ...decryptedContent, subject: '(No Subject)' };
      decryptContentPlainProcess(data, decryptedContent, isDecryptedError, false);
      return;
    }
    if (data.isSkipDecryptSubject) {
      decryptedContent = { ...decryptedContent, subject: data.mailData.subject };
      decryptContentPlainProcess(data, decryptedContent, isDecryptedError, false);
      return;
    }
    isDecryptedError = false;
    decryptedContent = { ...decryptedContent, subject: data.mailData.subject };
    decryptContentPlainProcess(data, decryptedContent, isDecryptedError, false);
  } else {
    decryptContent(data.mailData.subject, decryptedAllPrivKeys[data.mailboxId])
      .then(subject => {
        decryptedContent = { ...decryptedContent, subject };
        decryptContentPlainProcess(data, decryptedContent, isDecryptedError, false);
      })
      // Subject decryption error catch
      .catch((error) => {
        isDecryptedError = true;
        decryptedContent = { ...decryptedContent, subject: data.mailData.subject };
        decryptContentPlainProcess(data, decryptedContent, isDecryptedError, true);
      });
  }
}

/**
 * Decrypt Content_Plain, called by decryptSubjectProcess,
 * This is final process for decrypting SecureContent, will emit the `decrypted: true` event
 * @param data
 * @param decryptedContent
 * @param isDecryptedError
 * @param isSubjectDecryptedError
 */
function decryptContentPlainProcess(data, decryptedContent, isDecryptedError, isSubjectDecryptedError) {
  if (!data.isPGPMime && data.mailData.content_plain) {
    if (!isPGPEncrypted(data.mailData.content_plain)) {
      isDecryptedError = true;
      decryptedContent = { ...decryptedContent, content_plain: data.mailData.content_plain };
      postMessage({
        decryptedContent,
        decrypted: true,
        callerId: data.callerId,
        subjectId: data.subjectId,
        decryptedPGPMime: data.isPGPMime,
        isDecryptingAllSubjects: data.isDecryptingAllSubjects,
        error: isDecryptedError,
        isSubjectDecryptedError,
      });
    } else {
      decryptContent(data.mailData.content_plain, decryptedAllPrivKeys[data.mailboxId])
        .then(content_plain => {
          decryptedContent = { ...decryptedContent, content_plain };
          postMessage({
            decryptedContent,
            decrypted: true,
            callerId: data.callerId,
            subjectId: data.subjectId,
            decryptedPGPMime: false,
            isDecryptingAllSubjects: data.isDecryptingAllSubjects,
            error: isDecryptedError,
            isSubjectDecryptedError,
          });
        })
        // Content plain decryption error catch
        .catch((error) => {
          isDecryptedError = true;
          decryptedContent = { ...decryptedContent, content_plain: data.mailData.content_plain };
          postMessage({
            decryptedContent,
            decrypted: true,
            callerId: data.callerId,
            subjectId: data.subjectId,
            decryptedPGPMime: data.isPGPMime,
            isDecryptingAllSubjects: data.isDecryptingAllSubjects,
            error: isDecryptedError,
            isSubjectDecryptedError,
          });
        });
    }
  } else {
    decryptedContent = { ...decryptedContent, content_plain: '' };
    postMessage({
      decryptedContent,
      decrypted: true,
      callerId: data.callerId,
      subjectId: data.subjectId,
      decryptedPGPMime: data.isPGPMime,
      isDecryptingAllSubjects: data.isDecryptingAllSubjects,
      error: isDecryptedError,
      isSubjectDecryptedError,
    });
  }
}

