import { FilenamePipe } from '../../shared/pipes/filename.pipe';
import { ComposeMailActions, ComposeMailActionTypes } from '../actions';
import {
  ComposeMailState,
  Draft,
  PGP_MIME_DEFAULT_ATTACHMENT_FILE_NAME,
  PGP_MIME_DEFAULT_CONTENT,
  PGPEncryptionType,
} from '../datatypes';
import { Attachment, MailFolderType } from '../models';
import { getCryptoRandom } from '../services';

/**
 * 1. Force Making Draft Mail that contains general text content and  `encrypted.asc` as an attachment
 * 2. Remove the other attachment because `encrypted.asc` already contains all of attachment and content
 * 3. Set all of flags, so that it would be really composed after passed
 * @param draftMail
 * @param pgpMimeAttachment
 * @private
 */
function updateDraftMailForPGPMimeMessage(
  draftMail: Draft,
  oldAttachment: Attachment,
  newAttachment: Attachment,
): Draft {
  const newDraftMail = { ...draftMail };
  newDraftMail.draft.content = PGP_MIME_DEFAULT_CONTENT;
  newDraftMail.draft.content_plain = PGP_MIME_DEFAULT_CONTENT;
  newDraftMail.draft.is_encrypted = false;
  newDraftMail.draft.is_subject_encrypted = false;
  newDraftMail.draft.is_autocrypt_encrypted = false;
  newDraftMail.draft.encryption_type = PGPEncryptionType.PGP_MIME;
  newDraftMail.draft.attachments = [{ ...newAttachment, is_inline: true }];
  newDraftMail.attachments = [{ ...newAttachment, is_inline: true }];
  newDraftMail.isProcessingAttachments = false;
  newDraftMail.encryptedContent = undefined;
  newDraftMail.pgpMimeContent = undefined;
  newDraftMail.isPGPMimeMessage = true;
  newDraftMail.signContent = undefined;
  return newDraftMail;
}

export function reducer(
  // eslint-disable-next-line unicorn/no-object-as-default-parameter
  state: ComposeMailState = { drafts: {}, usersKeys: new Map() },
  action: ComposeMailActions,
): ComposeMailState {
  switch (action.type) {
    case ComposeMailActionTypes.SEND_MAIL:
    case ComposeMailActionTypes.CREATE_MAIL: {
      state.drafts[action.payload.id] = {
        ...state.drafts[action.payload.id],
        isSaving: true,
        inProgress: true,
        shouldSend: false,
        shouldSave: false,
        isSent: false,
      };
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.CREATE_MAIL_SUCCESS: {
      const oldDraft = state.drafts[action.payload.draft.id];
      const draftMail = action.payload.response;
      if (action.payload.draft.draft.forward_attachments_of_message) {
        oldDraft.attachments = draftMail.attachments.map((attachment: any) => {
          attachment.progress = 100;
          if (!attachment.name) {
            attachment.name = FilenamePipe.tranformToFilename(attachment.document);
          }
          attachment.draftId = oldDraft.id;
          attachment.attachmentId = performance.now() + Math.floor(getCryptoRandom() * 1000);
          return attachment;
        });
      }
      draftMail.is_html = oldDraft.draft.is_html;
      state.drafts[action.payload.draft.id] = {
        ...oldDraft,
        inProgress: false,
        isSent: false,
        draft: draftMail,
        isSaving: false,
      };
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.SEND_MAIL_SUCCESS: {
      delete state.drafts[action.payload.id];
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.SEND_MAIL_FAILURE: {
      state.drafts[action.payload.id] = {
        ...state.drafts[action.payload.id],
        draft: { ...state.drafts[action.payload.id].draft, send: false, folder: MailFolderType.DRAFT },
        inProgress: false,
        isSent: false,
      };
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.UPDATE_LOCAL_DRAFT: {
      state.drafts[action.payload.id] = { ...state.drafts[action.payload.id], ...action.payload, inProgress: true };
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.GET_USERS_KEYS: {
      if (action.payload.draftId && action.payload.draft) {
        state.drafts[action.payload.draftId] = {
          ...state.drafts[action.payload.draftId],
          ...action.payload.draft,
          // inProgress: true,
          getUserKeyInProgress: true,
        };
      }
      const { usersKeys, drafts } = state;
      action.payload.emails.forEach((email: string) => {
        usersKeys.set(email, { key: null, isFetching: true });
      });
      return { ...state, drafts: { ...drafts }, usersKeys };
    }

    case ComposeMailActionTypes.GET_USERS_KEYS_SUCCESS: {
      const { usersKeys, drafts } = state;
      if (action.payload.draftId) {
        // TODO - should be check
        drafts[action.payload.draftId] = {
          ...drafts[action.payload.draftId],
          getUserKeyInProgress: false,
          usersKeys: !action.payload.isBlind ? action.payload.data : drafts[action.payload.draftId].usersKeys,
        };
      }
      // Saving on global user keys
      if (!action.payload.isBlind && action.payload.data && action.payload.data.keys) {
        action.payload.data.keys.forEach((key: any) => {
          usersKeys.set(key.email, {
            key:
              usersKeys.has(key.email) && usersKeys.get(key.email).key && usersKeys.get(key.email).key.length > 0
                ? [...usersKeys.get(key.email).key, key]
                : [key],
            isFetching: false,
          });
        });
      }
      return {
        ...state,
        drafts: { ...drafts },
        usersKeys,
      };
    }

    case ComposeMailActionTypes.UPDATE_PGP_ENCRYPTED_CONTENT: {
      if (action.payload.draftId) {
        state.drafts[action.payload.draftId] = {
          ...state.drafts[action.payload.draftId],
          isPGPInProgress: action.payload.isPGPInProgress,
          encryptedContent: action.payload.encryptedContent,
        };
      }
      return {
        ...state,
        drafts: { ...state.drafts },
      };
    }

    case ComposeMailActionTypes.UPDATE_PGP_MIME_ENCRYPTED: {
      if (action.payload.draftId) {
        state.drafts[action.payload.draftId] = {
          ...state.drafts[action.payload.draftId],
          isPGPMimeInProgress: action.payload.isPGPMimeInProgress,
          pgpMimeContent: action.payload.encryptedContent,
        };
      }
      return {
        ...state,
        drafts: { ...state.drafts },
      };
    }

    case ComposeMailActionTypes.UPDATE_PGP_SSH_KEYS: {
      if (action.payload.draftId) {
        state.drafts[action.payload.draftId] = {
          ...state.drafts[action.payload.draftId],
          // isSshInProgress: action.payload.isSshInProgress,
        };
        if (action.payload.keys) {
          state.drafts[action.payload.draftId].draft = {
            ...state.drafts[action.payload.draftId].draft,
            encryption: {
              ...state.drafts[action.payload.draftId].draft.encryption,
              // private_key: action.payload.keys.private_key,
              // public_key: action.payload.keys.public_key,
            },
          };
        }
      }
      return {
        ...state,
        drafts: { ...state.drafts },
      };
    }

    case ComposeMailActionTypes.UPDATE_SIGN_CONTENT: {
      if (action.payload.draftId) {
        state.drafts[action.payload.draftId] = {
          ...state.drafts[action.payload.draftId],
          signContent: action.payload.signContent,
        };
      }
      return {
        ...state,
        drafts: { ...state.drafts },
      };
    }

    case ComposeMailActionTypes.CLOSE_MAILBOX: {
      if (action.payload && state.drafts[action.payload.id]) {
        state.drafts[action.payload.id] = { ...state.drafts[action.payload.id], isClosed: true };
        return { ...state, drafts: { ...state.drafts } };
      }
      return state;
    }

    case ComposeMailActionTypes.CLEAR_DRAFT: {
      delete state.drafts[action.payload.id];
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.START_ATTACHMENT_ENCRYPTION: {
      for (const [index, attachment] of state.drafts[action.payload.draftId].attachments.entries()) {
        if (attachment.attachmentId === action.payload.attachmentId) {
          state.drafts[action.payload.draftId].attachments[index] = {
            ...state.drafts[action.payload.draftId].attachments[index],
            inProgress: true,
          };
          state.drafts[action.payload.draftId] = {
            ...state.drafts[action.payload.draftId],
            isProcessingAttachments: true,
          };
        }
      }
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.UPLOAD_ATTACHMENT: {
      if (action.payload.id) {
        for (const [index, attachment] of state.drafts[action.payload.draftId].attachments.entries()) {
          if (attachment.attachmentId === action.payload.attachmentId) {
            state.drafts[action.payload.draftId].attachments[index] = {
              ...state.drafts[action.payload.draftId].attachments[index],
              inProgress: true,
            };
            state.drafts[action.payload.draftId] = {
              ...state.drafts[action.payload.draftId],
              isProcessingAttachments: true,
            };
          }
        }
      } else {
        state.drafts[action.payload.draftId].attachments = [
          ...state.drafts[action.payload.draftId].attachments,
          { ...action.payload, inProgress: true },
        ];
        state.drafts[action.payload.draftId] = {
          ...state.drafts[action.payload.draftId],
          isProcessingAttachments: true,
        };
      }
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.UPLOAD_ATTACHMENT_PROGRESS: {
      for (const [index, attachment] of state.drafts[action.payload.draftId].attachments.entries()) {
        if (attachment.attachmentId === action.payload.attachmentId) {
          state.drafts[action.payload.draftId].attachments[index] = {
            ...state.drafts[action.payload.draftId].attachments[index],
            progress: action.payload.progress,
          };
        }
      }
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.UPLOAD_ATTACHMENT_REQUEST: {
      for (const [index, attachment] of state.drafts[action.payload.draftId].attachments.entries()) {
        if (attachment.attachmentId === action.payload.attachmentId) {
          state.drafts[action.payload.draftId].attachments[index] = {
            ...state.drafts[action.payload.draftId].attachments[index],
            request: action.payload.request,
          };
        }
      }
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.UPLOAD_ATTACHMENT_SUCCESS: {
      const { data, isPGPMimeMessage, response } = action.payload;
      for (const [index, attachment] of state.drafts[data.draftId].attachments.entries()) {
        if (attachment.attachmentId === data.attachmentId) {
          state.drafts[data.draftId].attachments[index] = {
            ...state.drafts[data.draftId].attachments[index],
            id: response.id,
            document: response.document,
            content_id: response.content_id,
            inProgress: false,
            request: null,
          };
        }
      }
      const isProcessingAttachments = !!state.drafts[data.draftId].attachments.some(
        attachment => attachment.inProgress,
      );
      state.drafts[data.draftId] = { ...state.drafts[data.draftId], isProcessingAttachments };
      if (isPGPMimeMessage && data.name === PGP_MIME_DEFAULT_ATTACHMENT_FILE_NAME) {
        // PGP/MIME message process
        state.drafts[data.draftId] = updateDraftMailForPGPMimeMessage(state.drafts[data.draftId], data, response);
      }
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.UPLOAD_ATTACHMENT_FAILURE: {
      state.drafts[action.payload.draftId].attachments = state.drafts[action.payload.draftId].attachments.filter(
        attachment => attachment.attachmentId !== action.payload.attachmentId,
      );
      const isProcessingAttachments = !!state.drafts[action.payload.draftId].attachments.some(
        attachment => attachment.inProgress,
      );
      state.drafts[action.payload.draftId] = { ...state.drafts[action.payload.draftId], isProcessingAttachments };
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.DELETE_ATTACHMENT: {
      for (const [index, attachment] of state.drafts[action.payload.draftId].attachments.entries()) {
        if (attachment.attachmentId === action.payload.attachmentId) {
          state.drafts[action.payload.draftId].attachments[index] = {
            ...state.drafts[action.payload.draftId].attachments[index],
            isRemoved: true,
            inProgress: true,
          };
        }
      }
      state.drafts[action.payload.draftId] = { ...state.drafts[action.payload.draftId], isProcessingAttachments: true };
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.DELETE_ATTACHMENT_SUCCESS: {
      state.drafts[action.payload.draftId].attachments = state.drafts[action.payload.draftId].attachments.filter(
        attachment => {
          if (attachment.attachmentId === action.payload.attachmentId) {
            if (!attachment.id) {
              attachment.request.unsubscribe();
            }
            return false;
          }
          return true;
        },
      );
      const isProcessingAttachments = !!state.drafts[action.payload.draftId].attachments.some(
        attachment => attachment.inProgress,
      );
      state.drafts[action.payload.draftId] = { ...state.drafts[action.payload.draftId], isProcessingAttachments };
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.DELETE_ATTACHMENT_FAILURE: {
      for (const [index, attachment] of state.drafts[action.payload.draftId].attachments.entries()) {
        if (attachment.attachmentId === action.payload.attachmentId) {
          state.drafts[action.payload.draftId].attachments[index] = {
            ...state.drafts[action.payload.draftId].attachments[index],
            isRemoved: false,
            inProgress: false,
          };
        }
      }
      const isProcessingAttachments = !!state.drafts[action.payload.draftId].attachments.some(
        attachment => attachment.inProgress,
      );
      state.drafts[action.payload.draftId] = { ...state.drafts[action.payload.draftId], isProcessingAttachments };
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.NEW_DRAFT: {
      state.drafts[action.payload.id] = action.payload;
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.UPDATE_DRAFT_ATTACHMENT: {
      for (const [index, attachment] of state.drafts[action.payload.draftId].attachments.entries()) {
        if (attachment.attachmentId === action.payload.attachment.attachmentId) {
          state.drafts[action.payload.draftId].attachments[index] = {
            ...state.drafts[action.payload.draftId].attachments[index],
            ...action.payload.attachment,
          };
        }
      }
      return { ...state, drafts: { ...state.drafts } };
    }

    case ComposeMailActionTypes.MATCH_CONTACT_USER_KEYS: {
      const { usersKeys } = state;
      if (action.payload.contactKeyAdd) {
        const key = action.payload;
        usersKeys.set(key.email, {
          key:
            usersKeys.has(key.email) && usersKeys.get(key.email).key && usersKeys.get(key.email).key.length > 0
              ? [...usersKeys.get(key.email).key, { email: key.email, public_key: key.public_key }]
              : [{ email: key.email, public_key: key.public_key }],
          isFetching: false,
        });
        // eslint-disable-next-line no-empty
      } else if (action.payload.contactKeyUpdate) {
        // eslint-disable-next-line no-empty
      } else if (action.payload.contactKeyRemove) {
      } else if (action.payload.contactAdd) {
        // setting encryption type
        const { email, enabledEncryption, encryptionType } = action.payload;
        if (usersKeys.has(email) && usersKeys.get(email).key && usersKeys.get(email).key.length > 0) {
          usersKeys.set(email, {
            ...usersKeys.get(email),
            pgpEncryptionType: enabledEncryption ? encryptionType : null,
          });
        }
      }
      return { ...state, usersKeys };
    }

    default: {
      return state;
    }
  }
}
