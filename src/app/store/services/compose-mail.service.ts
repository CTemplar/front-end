import { ComponentFactoryResolver, ComponentRef, Injectable, ViewContainerRef } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { finalize, take } from 'rxjs/operators';
import { forkJoin, Observable, Subject } from 'rxjs';
import { Store } from '@ngrx/store';
import * as parseEmail from 'email-addresses';

import { ComposeMailDialogComponent } from '../../mail/mail-sidebar/compose-mail-dialog/compose-mail-dialog.component';
import {
  AppState,
  ComposeMailState,
  Contact,
  ContactsState,
  Draft,
  DraftState,
  GlobalPublicKey,
  PGP_MIME_DEFAULT_ATTACHMENT_FILE_NAME,
  PGPEncryptionType,
  PublicKey,
  SecureContent,
  UserState,
  SIGN_MESSAGE_DEFAULT_ATTACHMENT_FILE_NAME,
  SignContentType,
} from '../datatypes';
import { ClearDraft, CreateMail, SendMail, SnackPush, UploadAttachment } from '../actions';
import { Attachment } from '../models';

import { MailService } from './mail.service';
import { OpenPgpService } from './openpgp.service';
import { MessageBuilderService } from './message.builder.service';
import { AutocryptProcessService } from './autocrypt.process.service';
import { getCryptoRandom, SharedService } from './shared.service';

@Injectable({
  providedIn: 'root',
})
export class ComposeMailService {
  private drafts: DraftState;

  private composeMailContainer: ViewContainerRef;

  private componentRefList: Array<ComponentRef<ComposeMailDialogComponent>> = [];

  private userState: UserState;

  minimizedWidth = 192;

  originWidth = 640;

  windowWidth: number;

  maxComposeCount = 5;

  composesWidth: number;

  countCommonCompose: number;

  contacts: Contact[] = [];

  constructor(
    private store: Store<AppState>,
    private openPgpService: OpenPgpService,
    private mailService: MailService,
    private componentFactoryResolver: ComponentFactoryResolver,
    private messageBuilderService: MessageBuilderService,
    private autocryptProcessService: AutocryptProcessService,
    private sharedService: SharedService,
  ) {
    this.store
      .select((state: AppState) => state.composeMail)
      .subscribe((response: ComposeMailState) => {
        Object.keys(response.drafts).forEach((key: any) => {
          const { usersKeys, drafts } = response;
          const draftMail: Draft = drafts[key];
          if (draftMail.draft) {
            const signFlag = this.openPgpService.getMailboxSignFlag(draftMail.draft.mailbox);
            const encryptionTypeForExternal = this.getEncryptionTypeForExternal(draftMail, usersKeys);
            if (
              draftMail.shouldSave &&
              this.drafts[key] &&
              this.drafts[key].isPGPInProgress &&
              !draftMail.isPGPInProgress
            ) {
              if (!(encryptionTypeForExternal === PGPEncryptionType.PGP_INLINE && signFlag)) {
                this.setEncryptedContent(draftMail);
              }
              this.store.dispatch(new CreateMail({ ...draftMail }));
            } else if (draftMail.shouldSend && this.drafts[key]) {
              if (
                (this.drafts[key].isPGPInProgress &&
                  !draftMail.isPGPInProgress &&
                  !draftMail.isProcessingAttachments &&
                  !draftMail.signContent) ||
                (this.drafts[key].isProcessingAttachments &&
                  !draftMail.isPGPInProgress &&
                  !draftMail.isProcessingAttachments &&
                  !draftMail.signContent)
              ) {
                // PGP Encryption has been finished, don't need to set encryption data, if it is PGP/MIME message
                if (
                  !draftMail.isPGPMimeMessage &&
                  !(encryptionTypeForExternal === PGPEncryptionType.PGP_INLINE && signFlag)
                ) {
                  this.setEncryptedContent(draftMail);
                }
                if (!draftMail.isSaving) {
                  if (draftMail.draft && draftMail.draft.encryption && draftMail.draft.encryption.password) {
                    draftMail.draft.encryption.password = '';
                  }

                  if (encryptionTypeForExternal === PGPEncryptionType.PGP_INLINE && signFlag) {
                    this.openPgpService.signPGPInlineMessage(
                      draftMail.draft.mailbox,
                      new SecureContent(draftMail.draft),
                      draftMail.id,
                    );
                  } else {
                    if (signFlag) {
                      draftMail.draft.sign = SignContentType.BUILTIN;
                    }
                    this.store.dispatch(new SendMail({ ...draftMail }));
                  }
                } else {
                  this.store.dispatch(
                    new SnackPush({
                      message: 'Failed to send email, please try again. Email has been saved in draft.',
                    }),
                  );
                }
              } else if (this.drafts[key].isPGPMimeInProgress && !draftMail.isPGPMimeInProgress) {
                // Finished to encrypt PGP/MIME message context
                if (draftMail.pgpMimeContent) {
                  this.processPGPMimeMessage(draftMail);
                } else {
                  this.store.dispatch(
                    new SnackPush({
                      message: 'Failed to send email, please try again. Email has been saved in draft.',
                    }),
                  );
                }
              } else if (this.drafts[key].getUserKeyInProgress && !draftMail.getUserKeyInProgress) {
                // Finished to get the user keys
                let publicKeys: any[] = [];
                if (this.getShouldBeEncrypted(draftMail, usersKeys)) {
                  draftMail.draft.is_encrypted = true;
                  publicKeys = this.getPublicKeys(draftMail, usersKeys).map(item => item.public_key);
                }
                if (encryptionTypeForExternal !== undefined && publicKeys.length > 0) {
                  draftMail.draft.is_encrypted = false;
                  draftMail.draft.is_subject_encrypted = false;
                  if (encryptionTypeForExternal === PGPEncryptionType.PGP_INLINE) {
                    draftMail.draft.encryption_type = PGPEncryptionType.PGP_INLINE;
                  }
                }
                if (draftMail.draft && draftMail.draft.encryption && draftMail.draft.encryption.password) {
                  for (const attachment of draftMail.attachments) {
                    this.openPgpService.encryptAttachmentWithOnlyPassword(
                      attachment,
                      draftMail.draft.encryption.password,
                    );
                  }
                  this.openPgpService.encryptWithOnlyPassword(
                    draftMail.id,
                    new SecureContent(draftMail.draft),
                    draftMail.draft.encryption.password,
                  );
                } else if (publicKeys.length > 0) {
                  if (this.sharedService.checkRecipients(usersKeys, draftMail?.draft?.receiver || [])) {
                    // If all recipients are in CTemplar, not need to check autocrypt and ...
                    for (const attachment of draftMail.attachments) {
                      this.openPgpService.encryptAttachment(draftMail.draft.mailbox, attachment, publicKeys);
                    }
                    this.openPgpService.encrypt(
                      draftMail.draft.mailbox,
                      draftMail.id,
                      new SecureContent(draftMail.draft),
                      publicKeys,
                      encryptionTypeForExternal,
                      signFlag,
                    );
                  } else {
                    const determinedAutocryptStatus = autocryptProcessService.decideAutocryptDefaultEncryptionWithDraft(
                      draftMail,
                      usersKeys,
                    );
                    if (determinedAutocryptStatus.encryptTotally) {
                      this.buildPGPMimeMessageAndEncrypt(draftMail.id, publicKeys);
                    } else if (determinedAutocryptStatus.senderAutocryptEnabled) {
                      draftMail.draft.is_encrypted = false;
                      draftMail.draft.is_subject_encrypted = false;
                      this.sendEmailWithDecryptedData(false, draftMail, publicKeys, encryptionTypeForExternal);
                    } else if (encryptionTypeForExternal === PGPEncryptionType.PGP_MIME) {
                      this.buildPGPMimeMessageAndEncrypt(draftMail.id, publicKeys);
                    } else {
                      for (const attachment of draftMail.attachments) {
                        this.openPgpService.encryptAttachment(draftMail.draft.mailbox, attachment, publicKeys);
                      }
                      this.openPgpService.encrypt(
                        draftMail.draft.mailbox,
                        draftMail.id,
                        new SecureContent(draftMail.draft),
                        publicKeys,
                        encryptionTypeForExternal,
                      );
                    }
                  }
                } else if (!draftMail.isSaving) {
                  if (signFlag) {
                    this.openPgpService.signContents(
                      draftMail.draft.mailbox,
                      new SecureContent(draftMail.draft),
                      draftMail.id,
                    );
                  } else {
                    this.sendEmailWithDecryptedData(true, draftMail, publicKeys, encryptionTypeForExternal);
                  }
                } else {
                  this.store.dispatch(
                    new SnackPush({
                      message: 'Failed to send email, please try again. Email has been saved in draft.',
                    }),
                  );
                }
              } else if (signFlag && draftMail.signContent) {
                if (encryptionTypeForExternal === PGPEncryptionType.PGP_INLINE) {
                  draftMail.draft.content = draftMail.signContent;
                  this.store.dispatch(new SendMail({ ...draftMail }));
                } else if (
                  !draftMail.draft.attachments.some(a => a.name === SIGN_MESSAGE_DEFAULT_ATTACHMENT_FILE_NAME)
                ) {
                  const attachment = this.processSignContents(draftMail);
                  draftMail.draft.attachments.push(attachment);
                } else if (!draftMail.isProcessingAttachments) {
                  this.sendEmailWithDecryptedData(true, draftMail, [], undefined);
                }
              }
            }
          }
          if (draftMail.isClosed && !draftMail.shouldSend && !draftMail.shouldSave && !draftMail.inProgress) {
            this.store.dispatch(new ClearDraft(draftMail));
          }
        });

        this.drafts = { ...response.drafts };
      });

    this.store
      .select((state: AppState) => state.user)
      .subscribe((user: UserState) => {
        this.userState = user;
      });

    this.store
      .select((state: AppState) => state.contacts)
      .subscribe((contactsState: ContactsState) => {
        this.contacts = contactsState.contacts;
      });
  }

  private getShouldBeEncrypted(draftMail: Draft, usersKeys: Map<string, GlobalPublicKey>): boolean {
    if (draftMail.draft) {
      const keys = this.getPublicKeys(draftMail, usersKeys);
      return keys.every(key => key.public_key);
    }
    return false;
  }

  private getPublicKeys(draftMail: Draft, usersKeys: Map<string, GlobalPublicKey>): Array<PublicKey> {
    if (draftMail.draft) {
      const receivers: string[] = [
        ...draftMail.draft.receiver.map(receiver => receiver),
        ...draftMail.draft.cc.map(cc => cc),
        ...draftMail.draft.bcc.map(bcc => bcc),
      ];
      let keys: any[] = [];

      for (const receiver of receivers) {
        const parsedEmail = parseEmail.parseOneAddress(receiver) as parseEmail.ParsedMailbox;
        if (usersKeys.has(parsedEmail.address)) {
          keys = [...keys, ...usersKeys.get(parsedEmail.address).key];
        }
      }
      return keys;
    }
    return [];
  }

  private getEncryptionTypeForExternal(draftMail: Draft, usersKeys: Map<string, GlobalPublicKey>): PGPEncryptionType {
    if (draftMail.draft && draftMail.draft.receiver) {
      const receivers: string[] = [
        ...draftMail.draft.receiver.map(
          receiver => (parseEmail.parseOneAddress(receiver) as parseEmail.ParsedMailbox).address,
        ),
        ...draftMail.draft.cc.map(cc => (parseEmail.parseOneAddress(cc) as parseEmail.ParsedMailbox).address),
        ...draftMail.draft.bcc.map(bcc => (parseEmail.parseOneAddress(bcc) as parseEmail.ParsedMailbox).address),
      ];
      const isPGPInline = receivers.every(rec => {
        if (usersKeys.has(rec) && !usersKeys.get(rec).isFetching) {
          const contactInfo: Contact = this.contacts.find((contact: Contact) => contact.email === rec);
          if (
            contactInfo &&
            contactInfo.enabled_encryption &&
            contactInfo.encryption_type === PGPEncryptionType.PGP_INLINE
          ) {
            return true;
          }
        }
        return false;
      });
      if (isPGPInline) {
        return PGPEncryptionType.PGP_INLINE;
      }
      const isPGPMime = receivers.every(rec => {
        if (usersKeys.has(rec) && !usersKeys.get(rec).isFetching) {
          const contactInfo: Contact = this.contacts.find((contact: Contact) => contact.email === rec);
          if (
            contactInfo &&
            contactInfo.enabled_encryption &&
            contactInfo.encryption_type === PGPEncryptionType.PGP_MIME
          ) {
            return true;
          }
        }
        return false;
      });
      if (isPGPMime) {
        return PGPEncryptionType.PGP_MIME;
      }
      return undefined;
    }
    return undefined;
  }

  private setEncryptedContent(draftMail: Draft) {
    draftMail.draft.content = draftMail.encryptedContent.content;
    if (this.userState.settings) {
      draftMail.draft.subject = draftMail.encryptedContent.subject;
    }
    if (draftMail.draft.encryption && draftMail.draft.encryption.password) {
      draftMail.draft.is_subject_encrypted = true;
      draftMail.draft.is_encrypted = true;
    }
  }

  /**
   * Check if there is encrypted attachment,
   * If existed, decrypt and upload again attachment and
   * Encrypted or decrypted message is sent by `isEncryptMessageContent` flag
   * @param isEncryptMessageContent - Decide to encrypt the message content after proceed attachment
   * @param draftMail
   * @param publicKeys
   * @param encryptionTypeForExternal
   * @private
   */
  private sendEmailWithDecryptedData(
    isEncryptMessageContent: boolean,
    draftMail: Draft,
    publicKeys: any[] = [],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    encryptionTypeForExternal: PGPEncryptionType,
  ) {
    const encryptedAttachments = draftMail.attachments.filter(attachment => !!attachment.is_encrypted);
    if (encryptedAttachments.length > 0) {
      forkJoin(
        ...encryptedAttachments.map(attachment => {
          attachment.is_encrypted = false;
          attachment.document = attachment.decryptedDocument;
          return Observable.create((observer: any) => {
            this.mailService
              .uploadFile(attachment)
              .pipe(finalize(() => observer.complete()))
              .subscribe(
                event => {
                  if (event instanceof HttpResponse) {
                    observer.next(event.body);
                  }
                },
                error => observer.error(error),
              );
          });
        }),
      )
        .pipe(take(1))
        .subscribe(
          () => {
            if (!isEncryptMessageContent || publicKeys.length === 0) {
              this.store.dispatch(new SendMail({ ...draftMail }));
            } else {
              this.openPgpService.encrypt(
                draftMail.draft.mailbox,
                draftMail.id,
                new SecureContent(draftMail.draft),
                publicKeys,
              );
            }
          },
          () =>
            this.store.dispatch(
              new SnackPush({
                message: 'Failed to send email, please try again. Email has been saved in draft.',
              }),
            ),
        );
    } else if (!isEncryptMessageContent || publicKeys.length === 0) {
      this.store.dispatch(new SendMail({ ...draftMail }));
    } else {
      this.openPgpService.encrypt(
        draftMail.draft.mailbox,
        draftMail.id,
        new SecureContent(draftMail.draft),
        publicKeys,
      );
    }
  }

  private processSignContents(draftMail: Draft) {
    const { signContent, id, draft } = draftMail;
    const signFile = new File([signContent], SIGN_MESSAGE_DEFAULT_ATTACHMENT_FILE_NAME, {
      type: '',
    });
    const signAttachmentToUpload: Attachment = {
      draftId: id,
      document: signFile,
      decryptedDocument: signFile,
      inProgress: false,
      is_inline: false,
      is_encrypted: false,
      message: draft.id,
      name: SIGN_MESSAGE_DEFAULT_ATTACHMENT_FILE_NAME,
      size: signFile.size.toString(),
      actual_size: signFile.size,
      attachmentId: performance.now() + Math.floor(getCryptoRandom() * 1000),
    };

    const email = this.openPgpService.getMailboxEmail(draft.mailbox);
    const publicKey = this.openPgpService.getMailboxPublicKey(draft.mailbox);
    const publicKeyFileName = `publickey-${email}.asc`;
    const publicKeyFile = new File([publicKey], publicKeyFileName, {
      type: '',
    });
    const publicKeyAttachmentToUpload: Attachment = {
      draftId: id,
      document: publicKeyFile,
      decryptedDocument: publicKeyFile,
      inProgress: false,
      is_inline: false,
      is_encrypted: false,
      message: draft.id,
      name: publicKeyFileName,
      size: publicKeyFile.size.toString(),
      actual_size: publicKeyFile.size,
      attachmentId: performance.now() + Math.floor(getCryptoRandom() * 1000),
    };

    this.store.dispatch(new UploadAttachment({ ...signAttachmentToUpload }));
    this.store.dispatch(new UploadAttachment({ ...publicKeyAttachmentToUpload }));

    return signAttachmentToUpload;
  }

  /**
   * Force Making `encrypted.asc` file with `draftMail.encryptedContent`
   * @param draftMail
   * @private
   */
  private processPGPMimeMessage(draftMail: Draft) {
    const { pgpMimeContent, id, draft } = draftMail;
    const newDocument = new File([pgpMimeContent], PGP_MIME_DEFAULT_ATTACHMENT_FILE_NAME, {
      type: '',
    });
    const attachmentToUpload: Attachment = {
      document: newDocument,
      draftId: id,
      inProgress: false,
      is_inline: false,
      is_encrypted: false,
      message: draft.id,
      name: PGP_MIME_DEFAULT_ATTACHMENT_FILE_NAME,
      size: newDocument.size.toString(),
      actual_size: newDocument.size,
      is_pgp_mime: true,
    };
    this.store.dispatch(new UploadAttachment({ ...attachmentToUpload, isPGPMimeMessage: true }));
  }

  /**
   * Build PGP/MIME message with the standard format
   * @param draftMailId
   * @param publicKeys
   */
  buildPGPMimeMessageAndEncrypt(draftMailId: number, publicKeys: Array<any>) {
    const draftMail: Draft = this.drafts[draftMailId];
    if (draftMail?.draft?.id) {
      this.messageBuilderService
        .getMimeData(
          new SecureContent(draftMail.draft),
          draftMail.attachments,
          true,
          true,
          true,
          PGPEncryptionType.PGP_MIME,
        )
        .then(mimeData => {
          if (mimeData) {
            this.openPgpService.encryptForPGPMime(mimeData, draftMail.draft.mailbox, draftMail.id, publicKeys);
          } else {
            this.store.dispatch(
              new SnackPush({
                message: 'Failed to send email, please try again. Email has been saved in draft.',
              }),
            );
          }
        })
        .catch(() => {
          this.store.dispatch(
            new SnackPush({
              message: 'Failed to send email, please try again. Email has been saved in draft.',
            }),
          );
        });
    } else {
      setTimeout(() => {
        this.buildPGPMimeMessageAndEncrypt(draftMailId, publicKeys);
      }, 500);
    }
  }

  initComposeMailContainer(container: ViewContainerRef) {
    this.composeMailContainer = container;
    this.componentRefList = [];
  }

  getWindowWidth(width: any = {}) {
    // get current window's width
    this.windowWidth = width > 768 && width < 999 ? width - 68 : width;
    if (this.windowWidth > this.originWidth) {
      this.countCommonCompose =
        Math.trunc((this.windowWidth - this.originWidth) / this.minimizedWidth) + 1 > this.maxComposeCount
          ? this.maxComposeCount
          : Math.trunc((this.windowWidth - this.originWidth) / this.minimizedWidth) + 1;
    } else {
      this.countCommonCompose = 0;
    }
    let composesWidth = 0;
    if (this.componentRefList.length > 0) {
      // eslint-disable-next-line no-plusplus
      for (let index = this.componentRefList.length - 1; index > -1; index--) {
        composesWidth += this.componentRefList[index].instance.isMinimized ? this.minimizedWidth : this.originWidth;
        if (composesWidth > this.windowWidth) {
          if (!this.componentRefList[index].instance.isMinimized) {
            this.componentRefList[index].instance.isComposeVisible = true;
            this.componentRefList[index + 1].instance.isComposeVisible = false;
          } else {
            this.componentRefList[index].instance.isComposeVisible = false;
          }
          break;
        } else {
          this.componentRefList[index].instance.isComposeVisible = true;
        }
      }
    }
  }

  getComposesWidth() {
    // get entire width of opened Compose windows
    let temporaryWidth = 0;

    for (const componentReference of this.componentRefList) {
      if (componentReference.instance.isComposeVisible) {
        temporaryWidth += componentReference.instance.isMinimized ? this.minimizedWidth : this.originWidth;
      }
    }
    this.composesWidth = temporaryWidth;
  }

  openComposeMailDialog(inputData: any = {}, onHide: Subject<boolean> = new Subject<boolean>()) {
    if (this.userState && this.componentRefList.length < this.maxComposeCount) {
      for (const componentReference of this.componentRefList) {
        componentReference.instance.isMinimized = true;
      }

      if (inputData.draft) {
        const oldComponentReference = this.componentRefList.find(componentReference => {
          return (
            componentReference.instance.composeMail.draftMail &&
            componentReference.instance.composeMail.draftMail.id &&
            inputData.draft.id &&
            componentReference.instance.composeMail.draftMail.id === inputData.draft.id
          );
        });
        if (oldComponentReference) {
          oldComponentReference.instance.isMinimized = false;
          return;
        }
      }
      const factory = this.componentFactoryResolver.resolveComponentFactory(ComposeMailDialogComponent);
      const newComponentReference: ComponentRef<ComposeMailDialogComponent> =
        this.composeMailContainer.createComponent(factory);
      this.componentRefList.push(newComponentReference);

      for (const key of Object.keys(inputData)) {
        (newComponentReference as any).instance[key] = inputData[key];
      }
      newComponentReference.instance.isComposeVisible = true;
      newComponentReference.instance.isMinimized = false;
      this.getComposesWidth();
      newComponentReference.instance.hide.subscribe(() => {
        const index = this.componentRefList.indexOf(newComponentReference);
        this.destroyComponent(newComponentReference, index);
        if (onHide) {
          onHide.next(true);
        }
      });
      newComponentReference.instance.minimize.subscribe((isMinimized: boolean) => {
        if (!isMinimized) {
          // when Compose window is maximized

          for (const componentReference of this.componentRefList) {
            componentReference.instance.isMinimized = true;
            componentReference.instance.isFullScreen = false;
            componentReference.instance.isComposeVisible = true;
          }
          newComponentReference.instance.isMinimized = false;
          if (this.windowWidth < this.minimizedWidth * (this.componentRefList.length - 1) + this.originWidth) {
            let temporaryCount = 0;
            // eslint-disable-next-line no-plusplus
            for (let index = 0; index < this.componentRefList.length; index++) {
              if (temporaryCount === this.componentRefList.length - this.countCommonCompose) {
                break;
              }
              if (this.componentRefList[index].instance.isMinimized) {
                temporaryCount += 1;
                this.componentRefList[index].instance.isComposeVisible = false;
              }
            }
          }
        } else {
          // when Compose window is minimized

          for (const componentReference of this.componentRefList) {
            componentReference.instance.isMinimized = true;
            componentReference.instance.isComposeVisible = false;
          }
          let count = Math.trunc(this.windowWidth / this.minimizedWidth);
          if (this.componentRefList.length < count) {
            count = this.componentRefList.length;
          }
          // eslint-disable-next-line no-plusplus
          for (let index = this.componentRefList.length - 1; index >= this.componentRefList.length - count; index--) {
            this.componentRefList[index].instance.isComposeVisible = true;
          }
        }
      });
      newComponentReference.instance.fullScreen.subscribe((isFullScreen: boolean) => {
        if (isFullScreen) {
          for (const componentReference of this.componentRefList) {
            componentReference.instance.isFullScreen = false;
            componentReference.instance.isMinimized = true;
          }
          newComponentReference.instance.isFullScreen = true;
        }
      });
    } else {
      // display error message when user open more than 5 composer
      this.store.dispatch(new SnackPush({ message: 'Maximum composer reached.', duration: 5000 }));
    }
  }

  destroyAllComposeMailDialogs(): void {
    for (const componentReference of this.componentRefList) {
      componentReference.destroy();
    }
    this.componentRefList = [];
  }

  private destroyComponent(newComponentReference: ComponentRef<ComposeMailDialogComponent>, index: number) {
    newComponentReference.destroy();
    this.componentRefList.splice(index, 1);
    this.getComposesWidth();
    let countNewCompose = (this.windowWidth - this.composesWidth) / this.minimizedWidth;
    // eslint-disable-next-line no-plusplus
    for (let referenceIndex = this.componentRefList.length; referenceIndex > 0; referenceIndex--) {
      if (!this.componentRefList[referenceIndex - 1].instance.isComposeVisible && countNewCompose >= 1) {
        countNewCompose -= 1;
        this.componentRefList[referenceIndex - 1].instance.isComposeVisible = true;
      }
    }
  }
}
