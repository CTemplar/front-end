import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbDateStruct, NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { Store } from '@ngrx/store';
import * as parseEmail from 'email-addresses';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, finalize } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as xss from 'xss';

import * as DecoupledEditor from '../../../../assets/js/ckeditor-build/ckeditor';
import { COLORS, FONTS, SIZES } from '../../../shared/config';
import {
  CloseMailbox,
  DeleteAttachment,
  DeleteMail,
  GetEmailContacts,
  GetUsersKeys,
  NewDraft,
  SetIsComposerPopUp,
  SnackErrorPush,
  SnackPush,
  UpdateDraftAttachment,
  UpdateLocalDraft,
  UpdatePGPDecryptedContent,
  UploadAttachment,
} from '../../../store/actions';
import { FilenamePipe } from '../../../shared/pipes/filename.pipe';
import { FilesizePipe } from '../../../shared/pipes/filesize.pipe';
import { EmailFormatPipe } from '../../../shared/pipes/email-formatting.pipe';
import {
  AppState,
  AuthState,
  AutocryptEncryptDetermine,
  ComposeMailState,
  ComposerEncryptionType,
  Contact,
  ContactsState,
  Draft,
  GlobalPublicKey,
  MailAction,
  MailBoxesState,
  MailState,
  PGPEncryptionType,
  SecureContent,
  Settings,
  UserState,
  BlackList,
  WhiteList,
} from '../../../store/datatypes';
import { Attachment, EncryptionNonCTemplar, Mail, Mailbox, MailFolderType } from '../../../store/models';
import { AutocryptProcessService, MailService, SharedService, getCryptoRandom } from '../../../store/services';
import { DateTimeUtilService } from '../../../store/services/datetime-util.service';
import { OpenPgpService } from '../../../store/services/openpgp.service';
import { MailboxSettingsUpdate } from '../../../store/actions/mail.actions';

const updatedSizes = SIZES.map(size => {
  return `${size}px`;
});

export const PasswordValidation = {
  MatchPassword(AC: AbstractControl) {
    const password = AC.get('password').value; // to get value in password input tag
    const confirmPassword = AC.get('confirmPwd').value; // to get value in confirm password input tag
    if (password !== confirmPassword) {
      AC.get('confirmPwd').setErrors({ MatchPassword: true });
    }
  },
};

@UntilDestroy()
@Component({
  selector: 'app-compose-mail',
  templateUrl: './compose-mail.component.html',
  styleUrls: ['./compose-mail.component.scss', './../mail-sidebar.component.scss'],
})
export class ComposeMailComponent implements OnInit, AfterViewInit, OnDestroy {
  public DecoupledEditor = DecoupledEditor;

  composerEditorInstance: any;

  @Input() receivers: Array<string>;

  @Input() cc: Array<string>;

  // @Input() content = '';
  //
  // @Input() subject: string;

  @Input() draftMail: Mail;

  @Input() selectedMailbox: Mailbox;

  @Input() parentId: number;

  @Input() showSaveButton = true;

  @Input() forwardAttachmentsMessageId: number;

  @Input() action: MailAction;

  @Input() is_html: boolean;

  @Input() action_parent: number;

  @Input() isMailDetailPage: boolean;

  @Input() isFullScreen: boolean;

  @Input() isPopupOpen: boolean;

  @Input() isReplyInPopup: boolean;

  @Output() hide: EventEmitter<void> = new EventEmitter<void>();

  @Output() subjectChanged: EventEmitter<string> = new EventEmitter<string>();

  @Output() popUpChange: EventEmitter<any> = new EventEmitter<any>();

  @ViewChild('composerEditorElementRef', { read: ElementRef, static: false }) composerEditorElementRef: any;

  @ViewChild('attachmentHolder') attachmentHolder: any;

  @ViewChild('toolbar') toolbar: any;

  @ViewChild('attachImagesModal') attachImagesModal: any;

  @ViewChild('selfDestructModal') selfDestructModal: any;

  @ViewChild('delayedDeliveryModal') delayedDeliveryModal: any;

  @ViewChild('receiverInput') receiverInputRange: ElementRef;

  @ViewChild('ccReceiverInput') ccReceiverInputRange: ElementRef;

  @ViewChild('bccReceiverInput') bccReceiverInputRange: ElementRef;

  @ViewChild('deadManTimerModal') deadManTimerModal: any;

  @ViewChild('encryptionModal') encryptionModal: any;

  @ViewChild('insertLinkModal') insertLinkModal: any;

  @ViewChild('confirmationModal') confirmationModal: any;

  @ViewChild('closeConfirmationModal') closeConfirmationModal: any;

  confirmModalRef: NgbModalRef;

  closeConfirmModalRef: NgbModalRef;

  draftId: number;

  usersKeys: Map<string, GlobalPublicKey> = new Map();

  colors = COLORS;

  fonts = FONTS;

  sizes = updatedSizes;

  mailData: any = {};

  inputTextValue = '';

  ccInputTextValue = '';

  bccInputTextValue = '';

  night_mode: boolean;

  options: any = {};

  selfDestruct: any = {};

  delayedDelivery: any = {};

  deadManTimer: any = {};

  attachments: Attachment[] = [];

  isKeyboardOpened: boolean;

  isSelfDestruction: boolean;

  encryptForm: FormGroup;

  contacts: any = [];

  datePickerMinDate: NgbDateStruct;

  valueChanged$: Subject<any> = new Subject<any>();

  inProgress: boolean;

  isProcessingAttachments: boolean;

  isLoaded: boolean;

  delayDeliverTimeString: string;

  selfDestructTimeString: string;

  showEncryptFormErrors: boolean;

  isTrialPrimeFeaturesAvailable = false;

  mailBoxesState: MailBoxesState;

  isUploadingAttachment: boolean;

  isDownloadingAttachmentCounter = 0;

  insertLinkData: any = {};

  settings: Settings;

  mailAction = MailAction;

  isPasted = false;

  ccIsPasted = false;

  bccIsPasted = false;

  private isMailSent = false;

  private isSavedInDraft = false;

  private autoSaveSubscription: Subscription;

  private firstSaveSubscription: Subscription;

  private attachImagesModalRef: NgbModalRef;

  private selfDestructModalRef: NgbModalRef;

  private delayedDeliveryModalRef: NgbModalRef;

  private deadManTimerModalRef: NgbModalRef;

  private encryptionModalRef: NgbModalRef;

  private defaultLocale = 'US International';

  private draft: Draft;

  private attachmentsQueue: Array<Attachment> = [];

  private downloadingAttachments: any = {};

  private inlineAttachmentContentIds: Array<string> = [];

  private isSignatureAdded = false;

  private isAuthenticated: boolean;

  private saveDraftOnLogout: boolean;

  public userState: UserState = new UserState();

  private decryptedContent: string;

  private encryptionData: any = {};

  private loadContacts = true;

  private contactsState: ContactsState;

  private oldMailbox: Mailbox;

  isPreparingToSendEmail = false;

  /**
   * Decide to set html or plaintext mode with this variable
   */
  pgpEncryptionType: PGPEncryptionType = null;

  autocryptInfo: AutocryptEncryptDetermine;

  receiverEncryptTypeMap: any = {};

  blacklist: BlackList[] = [];

  whitelist: WhiteList[] = [];

  /**
   * This variable will be used for pass to suggest to add to the contact or update
   */
  clonedContacts: any[] = [];

  // composerEditor: any;

  constructor(
    private modalService: NgbModal,
    private store: Store<AppState>,
    private formBuilder: FormBuilder,
    private openPgpService: OpenPgpService,
    private mailService: MailService,
    private sharedService: SharedService,
    private dateTimeUtilService: DateTimeUtilService,
    private filesizePipe: FilesizePipe,
    private filenamePipe: FilenamePipe,
    private cdr: ChangeDetectorRef,
    private autocryptService: AutocryptProcessService,
  ) {}

  ngOnInit() {
    this.encryptForm = this.formBuilder.group(
      {
        password: ['', [Validators.required]],
        confirmPwd: ['', [Validators.required]],
        passwordHint: [''],
        days: [5, [Validators.required, Validators.min(0), Validators.max(5)]],
        hours: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
      },
      {
        validator: PasswordValidation.MatchPassword,
      },
    );
    this.resetMailData();
    this.initializeDraft();
    /**
     * Get current Compose state from Store and
     * Encrypt attachments of compose mail
     */
    this.store
      .select((state: AppState) => state.composeMail)
      .pipe(untilDestroyed(this))
      .subscribe((response: ComposeMailState) => {
        const draft = response.drafts[this.draftId];
        if (draft) {
          this.draftMail = draft.draft;
          this.inProgress = draft.inProgress;
          if (draft.isProcessingAttachments !== undefined) {
            this.isProcessingAttachments = draft.isProcessingAttachments;
            if (!this.isProcessingAttachments && this.closeConfirmModalRef) {
              this.closeConfirmModalRef.dismiss();
            }
          }
          if (draft.draft && draft.draft.id && this.attachmentsQueue.length > 0) {
            // when open draft mail with attachments
            for (const attachment of this.attachmentsQueue) {
              attachment.message = draft.draft.id;
              this.encryptAttachment(attachment);
            }
            this.attachmentsQueue = [];
          }
          if (!this.inProgress) {
            this.handleAttachment(draft);
          }
        }
        this.draft = draft;
        this.usersKeys = response.usersKeys;
        this.analyzeUsersKeysWithContact();
        const receivers = this.draftMail?.receiver;
        if (receivers && receivers.length > 0) {
          const receiversToFetchKey = receivers
            .map(rec => (parseEmail.parseOneAddress(rec.toLowerCase()) as parseEmail.ParsedMailbox).address)
            .filter(
              rec => !this.usersKeys.has(rec) || (!this.usersKeys.get(rec).key && !this.usersKeys.get(rec).isFetching),
            );
          if (receiversToFetchKey.length > 0) {
            this.store.dispatch(
              new GetUsersKeys({
                emails: receiversToFetchKey,
              }),
            );
          }
        }
      });

    /**
     * Get user's information from store.
     */
    this.store
      .select((state: AppState) => state.user)
      .pipe(untilDestroyed(this))
      .subscribe((user: UserState) => {
        this.userState = user;
        this.settings = user.settings;
        this.night_mode = this.settings.is_night_mode;
        this.blacklist = this.userState.blackList;
        this.whitelist = this.userState.whiteList;
        // Set html/plain version from user's settings.
        if (
          (this.action === 'FORWARD' && this.is_html === undefined) ||
          (this.draftMail && this.draftMail.is_html === null)
        ) {
          this.draftMail.is_html = !this.settings.is_html_disabled;
        }
        if (user.settings.is_contacts_encrypted) {
          this.contacts = [];
        }
      });

    /**
     * Get user's contacts from store.
     */
    this.store
      .select((state: AppState) => state.contacts)
      .pipe(untilDestroyed(this))
      .subscribe((contactsState: ContactsState) => {
        this.contacts = [];
        if (contactsState.emailContacts === undefined) {
          for (const x of contactsState.contacts) {
            this.contacts.push({
              name: x.name,
              email: x.email,
              display: EmailFormatPipe.transformToFormattedEmail(x.email, x.name),
            });
          }
        } else {
          for (const x of contactsState.emailContacts) {
            this.contacts.push({
              name: x.name,
              email: x.email,
              display: EmailFormatPipe.transformToFormattedEmail(x.email, x.name),
            });
          }
        }
        this.clonedContacts =
          contactsState.emailContacts === undefined ? contactsState.contacts : contactsState.emailContacts;
        this.contactsState = contactsState;
        this.analyzeUsersKeysWithContact();
        this.loadEmailContacts();
      });

    /**
     * Get user's current authentication status
     */
    this.store
      .select((state: AppState) => state.auth)
      .pipe(untilDestroyed(this))
      .subscribe((authState: AuthState) => {
        this.isAuthenticated = authState.isAuthenticated;
        this.saveDraftOnLogout = authState.saveDraftOnLogout;
        if (authState.saveDraftOnLogout) {
          this.updateEmail();
        } // save draft before logout
        this.loadEmailContacts();
      });

    /**
     * Get user's mailbox information
     */
    this.store
      .select(state => state.mailboxes)
      .pipe(untilDestroyed(this))
      .subscribe((mailBoxesState: MailBoxesState) => {
        if (!this.selectedMailbox) {
          if (this.draftMail && this.draftMail.mailbox) {
            this.selectedMailbox = mailBoxesState.mailboxes.find(mailbox => mailbox.id === this.draftMail.mailbox);
          } else if (mailBoxesState.currentMailbox) {
            this.selectedMailbox = mailBoxesState.currentMailbox;
            this.updateSignature();
          }
        }
        if (
          this.selectedMailbox &&
          mailBoxesState.currentMailbox &&
          this.selectedMailbox.id === mailBoxesState.currentMailbox.id
        ) {
          this.selectedMailbox = mailBoxesState.currentMailbox;
        }
        this.mailBoxesState = mailBoxesState;
        this.analyzeUsersKeysWithContact();
      });

    /**
     * Get mail status and
     * add decrypted content if content is not decrypted
     */
    this.store
      .select(state => state.mail)
      .pipe(untilDestroyed(this))
      .subscribe((mailState: MailState) => {
        if (this.draftMail && !this.decryptedContent) {
          const decryptedContent = mailState.decryptedContents[this.draftMail.id];
          if (decryptedContent && !decryptedContent.inProgress && decryptedContent.content) {
            this.decryptedContent = decryptedContent.content;
            if (this.draftMail.is_subject_encrypted) {
              // this.subject = decryptedContent.subject;
              // this.subjectChanged.emit(this.subject);
              this.subjectChanged.emit(decryptedContent.subject);
              this.mailData.subject = decryptedContent.subject;
            }
            this.addDecryptedContent();
          }
        }
      });

    const now = new Date();
    this.datePickerMinDate = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };

    if (this.action === 'FORWARD' && this.is_html !== undefined) {
      this.draftMail.is_html = this.is_html;
    }
    this.isSelfDestructionEnable(); // check self destruction is possible or not
    this.initializeAutoSave(); // start auto save function
  }

  ngAfterViewInit() {
    this.initializeComposeMail();
    if (this.forwardAttachmentsMessageId) {
      if (this.composerEditorElementRef) {
        this.updateEmail();
      } else {
        setTimeout(() => {
          this.updateEmail();
        }, 1000);
      }
    }
    this.cdr.detectChanges();
  }

  /**
   * Start Initializing...
   */
  initializeDraft() {
    // save compose content to draft for the first time
    this.draftId = Date.now();
    if (!this.draftMail) {
      this.draftMail = { is_html: null, content: null, folder: MailFolderType.DRAFT };
    } else {
      if (!this.action) {
        // This would be proceed if it's Draft mail
        this.openPgpService.decrypt(this.draftMail.mailbox, this.draftMail.id, new SecureContent(this.draftMail));
        this.isSignatureAdded = true;
      }
      if (this.draftMail.attachments) {
        this.inlineAttachmentContentIds = this.draftMail.attachments
          .filter((attachment: Attachment) => attachment.is_inline)
          .map(attachment => attachment.content_id);
      }
    }

    this.encryptionData = {};
    if (this.draftMail && this.draftMail.encryption) {
      this.encryptionData.password = this.draftMail.encryption.password;
      this.encryptionData.password_hint = this.draftMail.encryption.password_hint;
      this.encryptionData.expiryHours = this.draftMail.encryption.expiry_hours;
    }
    const draft: Draft = {
      id: this.draftId,
      draft: this.draftMail,
      inProgress: false,
      attachments:
        this.draftMail && this.draftMail.attachments
          ? this.draftMail.attachments.map(attachment => {
              attachment.progress = 100;
              attachment.name = attachment.name ? attachment.name : this.filenamePipe.transform(attachment.document);
              attachment.draftId = this.draftId;
              attachment.attachmentId = performance.now() + Math.floor(getCryptoRandom() * 1000);
              return attachment;
            })
          : [],
      usersKeys: null,
    };

    this.store.dispatch(new NewDraft({ ...draft }));
    this.decryptAttachments(draft.attachments);
  }

  /**
   * @Description
   * If draftMail is html, then process for CKEditor
   * Unless, just create content
   */
  initializeComposeMail() {
    if (this.draftMail.is_html === null || this.draftMail.is_html) {
      if (this.composerEditorElementRef) {
        this.initializeCKEditor();
      }
    } else {
      // display mail content and change from html to text if html version
      let content = this.mailData.content ? this.mailData.content : '';
      content = this.composerEditorInstance?.getData() || content;
      if (content) {
        content = this.getPlainText(content);
      }
      if (content) {
        setTimeout(() => {
          this.mailData.content = content;
          this.updateSignature();
        }, 300);
      }
    }
  }

  onEditorReady(editor: any) {
    if (!this.composerEditorInstance) {
      this.composerEditorInstance =
        this.composerEditorElementRef?.nativeElement?.querySelector('.ck-editor__editable')?.ckeditorInstance;
    }
    const toolbarContainer = document.querySelector('#toolbar');
    toolbarContainer.append(editor.ui.view.toolbar.element);
    // need to change text to html contents
    if (this.mailData.content) {
      editor.setData(this.formatContent(this.mailData.content));
    }
    this.updateSignature();
    editor.editing.view.focus();

    // Configure for default settings
    // This should be done after filled the data up
    if (this.settings) {
      editor.execute('fontSize', { value: `${this.settings.default_size}px` });
      editor.execute('fontColor', {
        value: this.settings.default_color !== 'none' ? this.settings.default_color : 'black',
      });
      editor.execute('fontBackgroundColor', { value: this.settings.default_background });
      editor.execute('fontFamily', { value: this.settings.default_font });
    }
    editor.model.document.on('change', () => {
      this.valueChanged$.next();
    });
  }

  initializeCKEditor() {
    // It's blank due to using custom build
    // All of configuration is done on build
  }

  initializeAutoSave() {
    if (this.settings.autosave_duration !== 'none') {
      this.autoSaveSubscription = this.valueChanged$
        .pipe(
          debounceTime(Number(this.settings.autosave_duration)), // get autosave interval from user's settings
        )
        .subscribe(() => {
          if (!this.draft.isSaving && this.hasData()) {
            this.updateEmail();
          }
        });
    }
    if (!this.draft.draft.id) {
      this.updateEmail();
    }
  }

  /**
   * Sanitizing Html Content
   * @param content
   * @private
   */
  private formatContent(content: string) {
    if (this.draftMail.is_html) {
      const allowedTags = new Set([
        'a',
        'b',
        'br',
        'div',
        'font',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'hr',
        'img',
        'label',
        'li',
        'ol',
        'p',
        'span',
        'strong',
        'table',
        'td',
        'th',
        'tr',
        'u',
        'ul',
        'i',
        'blockquote',
      ]);
      // @ts-ignore
      const xssValue = xss(content, {
        onTag: (tag: string, html: string, options: any) => {
          if (options && !options.isClosing && allowedTags.has(tag.toLowerCase())) {
            let htmlAttributes = '';
            const spaceIndex = html.indexOf(' ');
            if (spaceIndex > 0) {
              htmlAttributes = html.slice(spaceIndex + 1, -1).trim();
            }
            const attributesHtml = xss.parseAttr(htmlAttributes, (attributeName, attributeValue) => {
              return `${attributeName}="${attributeValue}"`;
            });
            let outputHtml = `<${tag}`;
            if (attributesHtml) {
              outputHtml += ` ${attributesHtml}`;
            }
            outputHtml += '>';
            return outputHtml;
          }
          return html;
        },
      });
      // TODO, should be double checked
      // return xssValue.replace(/\n/g, '<br>');
      return xssValue;
    }
    return content;
  }

  private resetMailData() {
    this.resetSelfDestructValues();
    this.resetDelayedDeliveryValues();
    this.resetDeadManTimerValues();
    this.mailData = {
      receiver: this.receivers
        ? this.receivers.map(receiver => ({ display: receiver, value: receiver, email: receiver }))
        : this.draftMail && this.draftMail.receiver
        ? this.draftMail.receiver.map(receiver => ({ display: receiver, value: receiver, email: receiver }))
        : [],
      cc: this.cc
        ? this.cc.map(address => ({ display: address, value: address, email: address }))
        : this.draftMail && this.draftMail.cc
        ? this.draftMail.cc.map(receiver => ({ display: receiver, value: receiver, email: receiver }))
        : [],
      bcc:
        this.draftMail && this.draftMail.bcc
          ? this.draftMail.bcc.map(receiver => ({ display: receiver, value: receiver, email: receiver }))
          : [],
      subject:
        this.draftMail && this.draftMail.is_subject_encrypted ? '' : this.draftMail ? this.draftMail.subject : '',
      content: '',
    };
    // action is existed MEANS this compose is either REPLY or REPLY_ALL or FORWARD
    // this.draftMail.content would not be encrypted, but PURE
    if (this.action) {
      this.mailData.content = this.draftMail.content;
    }
    if (this.mailData.cc.length > 0) {
      this.options.isCcVisible = true;
    }
    if (this.mailData.bcc.length > 0) {
      this.options.isBccVisible = true;
    }
    this.selfDestruct.value = this.draftMail ? this.draftMail.destruct_date : null;
    this.deadManTimer.value = this.draftMail ? this.draftMail.dead_man_duration : null;
    this.delayedDelivery.value = this.draftMail ? this.draftMail.delayed_delivery : null;
    this.isLoaded = true;
  }

  addDecryptedContent() {
    if (!this.draftMail.is_html) {
      this.mailData.content = this.getPlainText(this.decryptedContent);
      return;
    }
    this.composerEditorInstance?.setData(this.decryptedContent);
  }

  setHtmlEditor(value: boolean) {
    this.draftMail.is_html = value;
    if (value) {
      this.cdr.detectChanges();
    }
    this.initializeComposeMail();
    if (!value) {
      this.cdr.detectChanges();
    }
    this.valueChanged$.next();
  }
  /**
   * End Initializing
   */

  handleRemoveRecipient(recipientType: string) {
    switch (recipientType) {
      case 'receiver':
        this.valueChanged$.next(this.mailData.receiver);
        break;
      case 'ccReceiver':
        this.valueChanged$.next(this.mailData.cc);
        break;
      case 'bccReceiver':
        this.valueChanged$.next(this.mailData.bcc);
        break;
      default:
        break;
    }
    this.isSelfDestructionEnable();
    this.analyzeUsersKeysWithContact();
  }

  validateEmail(email: string) {
    const re =
      /^(([^\s"(),.:;<>@[\\\]]+(\.[^\s"(),.:;<>@[\\\]]+)*)|(".+"))@((\[(?:\d{1,3}\.){3}\d{1,3}])|(([\dA-Za-z-]+\.)+[A-Za-z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }

  /**
   * Start Tag Editing for receiver, cc, bcc
   * @param $event
   */
  onTagEdited($event: any) {
    this.mailData.receiver[$event.index] = { display: $event.display, value: $event.value, email: $event.value };
    this.isSelfDestructionEnable();
    this.analyzeUsersKeysWithContact();
  }

  ccOnTagEdited($event: any) {
    this.mailData.cc[$event.index] = { display: $event.display, value: $event.value, email: $event.value };
    this.isSelfDestructionEnable();
    this.analyzeUsersKeysWithContact();
  }

  bccOnTagEdited($event: any) {
    this.mailData.bcc[$event.index] = { display: $event.display, value: $event.value, email: $event.value };
    this.isSelfDestructionEnable();
    this.analyzeUsersKeysWithContact();
  }
  /**
   * End Tag editing
   */

  onClick() {
    this.receiverInputRange.nativeElement.querySelector('input[type="text"]').focus();
  }

  onCcClick() {
    this.ccReceiverInputRange.nativeElement.querySelector('input[type="text"]').focus();
  }

  onBccClick() {
    this.bccReceiverInputRange.nativeElement.querySelector('input[type="text"]').focus();
  }

  openReplyinPopup() {
    this.store.dispatch(new SetIsComposerPopUp(true));
    this.popUpChange.emit({
      receivers: this.receivers,
      draftMail: this.draftMail,
      forwardAttachmentsMessageId: this.forwardAttachmentsMessageId,
      action: this.action,
      parentId: this.parentId,
    });
  }

  onSubjectChange(subject: string) {
    this.subjectChanged.emit(subject);
  }

  private getPlainText(html: string) {
    // Change html content to text content by deletng html tags
    if (!/<\/?[a-z][\S\s]*>/i.test(html)) {
      return html;
    }
    const element = document.createElement('div');
    element.innerHTML = html
      .replace(/<\/div>/g, '<br></div>')
      .replace(/<\/p>/g, '<br></p>')
      .replace(/<br>/g, '\n')
      .replace(/<\/br>/g, '\n');
    return element.textContent;
  }

  loadEmailContacts() {
    if (
      this.isAuthenticated &&
      this.loadContacts &&
      !this.contacts &&
      this.contactsState &&
      !this.contactsState.loaded &&
      !this.contactsState.inProgress &&
      !this.userState.settings.is_contacts_encrypted
    ) {
      this.loadContacts = false;
      this.store.dispatch(new GetEmailContacts());
    }
  }

  decryptAttachments(attachments: Array<Attachment>) {
    for (const attachment of attachments) {
      // TODO: Do we need to download attachment even if it is not encrypted?
      if (!attachment.decryptedDocument && !this.downloadingAttachments[attachment.id] && !attachment.is_pgp_mime) {
        this.downloadingAttachments[attachment.id] = true;
        this.isDownloadingAttachmentCounter += 1;
        this.mailService
          .getAttachment(attachment)
          .pipe(untilDestroyed(this))
          .pipe(
            finalize(() => {
              this.isDownloadingAttachmentCounter -= 1;
            }),
          )
          .subscribe(
            response => {
              if (attachment.is_encrypted) {
                // if attachment is encrypted, update draft attachment with decrypted attachment
                const fileInfo = { attachment, type: response.file_type };
                this.openPgpService
                  .decryptAttachment(this.draftMail.mailbox, response.data, fileInfo)
                  .subscribe(decryptedAttachment => {
                    this.store.dispatch(
                      new UpdateDraftAttachment({
                        draftId: this.draftId,
                        attachment: { ...decryptedAttachment },
                      }),
                    );
                  });
              } else {
                // if attachment is not encrypted, update draft attachment with decoded attachment
                const uint8Array = this.sharedService.base64ToUint8Array(response.data);
                const newDocument = new File(
                  [uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteLength + uint8Array.byteOffset)],
                  attachment.name,
                  { type: response.file_type },
                );
                const newAttachment: Attachment = { ...attachment, decryptedDocument: newDocument };
                this.store.dispatch(
                  new UpdateDraftAttachment({
                    draftId: this.draftId,
                    attachment: { ...newAttachment },
                  }),
                );
              }
            },
            () => this.store.dispatch(new SnackErrorPush({ message: 'Failed to get attachments.' })),
          );
      }
    }
  }

  insertLink(text: string, link: string) {
    // add content with link based on https or http
    this.insertLinkData.modalRef.close();
    if (!/^https?:\/\//i.test(link)) {
      link = `http://${link}`;
    }
    this.composerEditorInstance?.model.change((writer: any) => {
      const linkElement = writer.createText(text, {
        linkHref: link,
      });
      this.composerEditorInstance?.model.insertContent(
        linkElement,
        this.composerEditorInstance?.model.document.selection,
      );
    });
  }

  openInsertLinkModal() {
    this.insertLinkData = {};
    this.insertLinkData.modalRef = this.modalService.open(this.insertLinkModal, {
      centered: true,
      windowClass: 'modal-sm users-action-modal',
    });
  }

  onInsertImage() {
    this.attachImagesModalRef = this.modalService.open(this.attachImagesModal, {
      centered: true,
      windowClass: 'modal-sm users-action-modal',
    });
  }

  onFromChanged(mailbox: Mailbox, oldMailbox: Mailbox) {
    // when user change current mailbox on From field of Compose window
    if (oldMailbox === mailbox) {
      return;
    }
    this.selectedMailbox = mailbox;
    this.oldMailbox = oldMailbox;
    this.updateSignature();
    this.valueChanged$.next(this.selectedMailbox);
    this.analyzeUsersKeysWithContact();
  }

  onImagesSelected(files: FileList) {
    // if (!this.draftMail || !this.draftMail.id) {
    //   this.updateEmail();
    // }
    // eslint-disable-next-line @typescript-eslint/no-this-alias,unicorn/no-this-assignment
    const clonedThis = this;
    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < files.length; index++) {
      const file = files.item(index);
      if (/^image\//.test(file.type)) {
        const FR = new FileReader();
        FR.addEventListener('load', event => {
          clonedThis.composerEditorInstance?.model.change((writer: any) => {
            const imageElement = writer.createElement('image', {
              src: event.target.result,
            });
            // Insert the image in the current selection location.
            clonedThis.composerEditorInstance?.model.insertContent(
              imageElement,
              clonedThis.composerEditorInstance?.model.document.selection,
            );
          });
        });
        FR.readAsDataURL(file);
      } else {
        // TODO: add error notification for invalid file type here
      }
    }
  }

  onFilesSelected(files: FileList) {
    this.isProcessingAttachments = true;
    if ((!this.draftMail || !this.draftMail.id) && !this.draft.isSaving) {
      this.updateEmail();
    }
    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < files.length; index++) {
      const file: File = files.item(index);
      this.uploadAttachment(file, false);
    }
  }

  uploadAttachment(file: File, isInline = false) {
    if (this.checkAttachmentSizeLimit(file)) {
      this.attachmentHolder.nativeElement.scrollIntoView({ behavior: 'smooth' });
      const attachment: Attachment = {
        draftId: this.draftId,
        document: file,
        decryptedDocument: file,
        name: file.name,
        size: this.filesizePipe.transform(file.size),
        attachmentId: performance.now() + Math.floor(getCryptoRandom() * 1000),
        message: this.draftMail.id,
        is_inline: isInline,
        is_encrypted: !isInline,
        inProgress: false,
        actual_size: file.size,
      };
      this.attachments.push(attachment);
      if (!this.draftMail.id) {
        this.attachmentsQueue.push(attachment);
      } else {
        this.encryptAttachment(attachment);
      }
    }
  }

  checkAttachmentSizeLimit(file: File): boolean {
    // there is limit size of attachment from user's settings
    const attachmentLimitInMBs = this.settings.attachment_size_limit / (1024 * 1024);
    if (file.size > this.settings.attachment_size_limit) {
      this.store.dispatch(
        new SnackErrorPush({
          message: this.settings.attachment_size_error || `Maximum allowed file size is ${attachmentLimitInMBs}MB.`,
        }),
      );
      return false;
    }
    return true;
  }

  encryptAttachment(attachment: Attachment) {
    if (attachment.is_inline) {
      this.store.dispatch(new UploadAttachment({ ...attachment }));
    } else {
      this.openPgpService.encryptAttachment(this.selectedMailbox.id, attachment);
    }
  }

  handleAttachment(draft: Draft) {
    // usage Object.assign to create new copy and avoid storing reference of draft.attachments
    this.attachments = Object.assign([], draft.attachments);
    this.decryptAttachments(this.attachments);
    this.isUploadingAttachment = false;
    // TODO: remove this if its not required anymore due to change in handling of inline attachments?
    for (const attachment of this.attachments) {
      if (
        attachment.is_inline &&
        attachment.progress === 100 &&
        !attachment.isRemoved &&
        attachment.content_id &&
        (!attachment.is_encrypted || attachment.decryptedDocument) &&
        !this.inlineAttachmentContentIds.includes(attachment.content_id)
      ) {
        this.inlineAttachmentContentIds.push(attachment.content_id);
        // if (!attachment.is_forwarded) {
        //   this.embedImageInQuill(attachment.document, attachment.content_id);
        // }
      }
      if (attachment.progress < 100 && !attachment.isRemoved) {
        this.isUploadingAttachment = true;
      }
    }
  }

  onAttachImageURL(url: string) {
    // this.embedImageInQuill(url);
    this.composerEditorInstance?.model.change((writer: any) => {
      const imageElement = writer.createElement('image', {
        src: url,
      });
      // Insert the image in the current selection location.
      this.composerEditorInstance?.model.insertContent(
        imageElement,
        this.composerEditorInstance?.model.document.selection,
      );
    });
    this.attachImagesModalRef.dismiss();
  }

  saveInDrafts() {
    if (this.inProgress || this.draft?.isSaving || this.isProcessingAttachments) {
      // If saving is in progress, then wait to send.
      setTimeout(() => {
        this.saveInDrafts();
      }, 100);
      return;
    }
    if (this.isSavedInDraft) {
      // if email already saved in ngOnDestroy.
      return;
    }
    this.isSavedInDraft = true;
    this.updateEmail();
    this.hide.emit();
    this.resetValues();
  }

  closeCompose() {
    if (this.isProcessingAttachments) {
      this.closeConfirmModalRef = this.modalService.open(this.closeConfirmationModal, {
        centered: true,
        windowClass: 'modal-sm users-action-modal',
      });
    } else {
      this.saveInDrafts();
    }
  }

  closeComposeConfirm() {
    if (this.closeConfirmModalRef) {
      this.closeConfirmModalRef.dismiss();
    }
    if (this.isProcessingAttachments) {
      const { attachments } = this;
      for (const attachment of attachments) {
        if (attachment.inProgress) {
          this.removeAttachment(attachment);
        }
      }
    }
    this.saveInDrafts();
  }

  discardEmail() {
    if (this.inProgress || (this.draft && this.draft.isSaving) || this.isProcessingAttachments) {
      // If saving is in progress, then wait to send.
      setTimeout(() => {
        this.discardEmail();
      }, 100);
      return;
    }
    this.isSavedInDraft = true;
    if (this.draftMail && this.draftMail.id) {
      this.store.dispatch(new DeleteMail({ ids: [this.draftMail.id].join(','), folder: this.draftMail.folder }));
    }
    this.hide.emit();
    this.resetValues();
  }

  isSelfDestructionEnable() {
    this.isSelfDestruction = false;
    const receivers: string[] = [
      ...this.mailData.receiver.map((receiver: any) => receiver.email),
      ...this.mailData.cc.map((cc: any) => cc.email),
      ...this.mailData.bcc.map((bcc: any) => bcc.email),
    ];
    for (const receiver of receivers) {
      const getDomain = receiver.slice(receiver.indexOf('@') + 1, receiver.length);
      if (getDomain === 'ctemplar.com') {
        this.isSelfDestruction = true;
      }
    }
    if (!this.isSelfDestruction && this.selfDestruct.date) {
      this.clearSelfDestructValue();
    }
  }

  // Temporary Commenting
  // Not sure this operation would be needed.
  /*
  addHyperLink() {
    const regex =
      /(https?:\/\/(?:www\.|(?!www))[\da-z][\da-z-]+[\da-z]\.\S{2,}|www\.[\da-z][\da-z-]+[\da-z]\.\S{2,}|https?:\/\/(?:www\.|(?!www))[\da-z]+\.\S{2,}|[\da-z][\da-z-]+[\da-z]\.com|www\.[\da-z]+\.\S{2,})/gi;
    this.quill.focus();
    const contents = this.quill.getText();
    const filtered = contents.trim().split(/\s+/);
    for (const element of filtered) {
      const match = element.match(regex);
      if (match !== null) {
        const url = match[0];
        let hyperLink = url;
        if (!/^https?:\/\//i.test(url)) {
          hyperLink = `http://${url}`;
        }
        const position = contents.indexOf(url);
        this.quill.updateContents(
          new Delta().retain(position).delete(url.length).insert(url, { link: hyperLink, target: '_blank' }),
        );
      }
    }
  }
  */

  /**
   * Check exceptions and validations of subject and receiver before send mail
   */
  sendEmailCheck() {
    if (this.isPreparingToSendEmail) return;
    if (!this.selectedMailbox.is_enabled) {
      this.store.dispatch(
        new SnackPush({ message: 'Selected email address is disabled. Please select a different email address.' }),
      );
      return;
    }
    const receivers: string[] = [
      ...this.mailData.receiver.map((receiver: any) => receiver.email.toLowerCase()),
      ...this.mailData.cc.map((cc: any) => cc.email.toLowerCase()),
      ...this.mailData.bcc.map((bcc: any) => bcc.email.toLowerCase()),
    ];
    if (receivers.length === 0) {
      this.store.dispatch(new SnackErrorPush({ message: 'Please enter receiver email.' }));
      return;
    }
    const invalidAddress = receivers.find(receiver => !this.sharedService.isRFCStandardValidEmail(receiver));
    if (invalidAddress) {
      this.store.dispatch(new SnackErrorPush({ message: `"${invalidAddress}" is not valid email address.` }));
      return;
    }
    this.isPreparingToSendEmail = true;
    if (this.inProgress || (this.draft && this.draft.isSaving) || this.isProcessingAttachments) {
      // If saving is in progress, then wait to send.
      setTimeout(() => {
        this.isPreparingToSendEmail = false;
        this.sendEmailCheck();
      }, 100);
      return;
    }

    // Attach public key if needed
    const publicKeyFileName = `publickey-${this.selectedMailbox.email}.asc`;
    if (
      !this.selectedMailbox.is_pgp_sign &&
      this.selectedMailbox.is_attach_public_key &&
      !this.attachments.some(a => a.name === publicKeyFileName)
    ) {
      const publicKeyFile = new File([this.selectedMailbox.public_key], publicKeyFileName);
      this.isProcessingAttachments = true;
      this.uploadAttachment(publicKeyFile, false);

      setTimeout(() => {
        this.isPreparingToSendEmail = false;
        this.sendEmailCheck();
      }, 500);
      return;
    }

    if (
      receivers.some(
        receiver => this.usersKeys.has(receiver.toLowerCase()) && this.usersKeys.get(receiver.toLowerCase()).isFetching,
      )
    ) {
      // If fetching for user key, wait to send
      setTimeout(() => {
        this.isPreparingToSendEmail = false;
        this.sendEmailCheck();
      }, 100);
      return;
    }
    if (
      this.mailData.subject === '' &&
      ((this.draftMail.is_html &&
        this.getPlainText(this.composerEditorInstance?.getData()).replace(/ /g, '').replace(/\n/g, '').length === 0) ||
        (!this.draftMail.is_html && this.mailData.content.replace(/ /g, '').replace(/\n/g, '').length === 0))
    ) {
      // show message to confirm without subject and content
      this.confirmModalRef = this.modalService.open(this.confirmationModal, {
        centered: true,
        windowClass: 'modal-sm users-action-modal',
      });
    } else {
      // if (this.draftMail.is_html) {
      //   this.addHyperLink();
      // }
      this.sendEmail();
    }
  }

  sendEmail() {
    if (this.confirmModalRef) {
      this.confirmModalRef.dismiss();
    }
    let receivers: string[] = [
      ...this.mailData.receiver.map((receiver: any) => receiver.display.toLowerCase()),
      ...this.mailData.cc.map((cc: any) => cc.display.toLowerCase()),
      ...this.mailData.bcc.map((bcc: any) => bcc.display.toLowerCase()),
    ];
    receivers = receivers.filter(
      email =>
        !this.usersKeys.has(email.toLowerCase()) ||
        (!this.usersKeys.get(email.toLowerCase()).key && !this.usersKeys.get(email.toLowerCase()).isFetching),
    );

    if (!this.draftMail?.is_html && this.settings.is_hard_wrap) {
      // mail content hard wrap
      this.mailData.content = this.mailData.content.replace(
        new RegExp(`(?![^\\n]{1,${80}}$)([^\\n]{1,${80}})\\s`, 'g'),
        '$1\n',
      );
    }
    this.isMailSent = true;
    this.setMailData(true, false);
    this.inProgress = true;
    this.store.dispatch(
      new GetUsersKeys({
        draftId: this.draftId,
        emails: receivers,
        draft: {
          ...this.draft,
          isMailDetailPage: this.isMailDetailPage,
          isSaving: false,
          shouldSave: false,
          shouldSend: true,
          draft: { ...this.draftMail },
        },
      }),
    );
    const message = this.delayedDelivery.value || this.deadManTimer.value ? 'Scheduling mail...' : 'Sending mail...';

    this.store.dispatch(new SnackPush({ message, duration: 120_000 }));
    this.resetValues();
    this.hide.emit();
  }

  removeAttachment(attachment: Attachment) {
    if (!attachment.isRemoved) {
      attachment.isRemoved = true;
      this.store.dispatch(new DeleteAttachment(attachment));
    }
  }

  /**
   * Add signature on content of Compose message
   */
  updateSignature() {
    if (!this.isSignatureAdded) {
      if (this.settings && !this.draftMail.is_html) {
        // add plaintext signature and return if plain text mode
        this.isSignatureAdded = true;
        this.mailData.content = this.mailData.content ? this.mailData.content : '';
        if (this.selectedMailbox.signature) {
          this.mailData.content = `\n\n${this.getPlainText(this.selectedMailbox.signature)}${this.mailData.content}`;
        }
        return;
      }
      /**
       * add html signature if html version
       */
      let content: string;
      let oldSig: string;
      let newSig: string;
      if (this.composerEditorInstance) {
        content = this.composerEditorInstance?.getData() || '';
        content = content.replace(/\n\n/g, '<br>');
        if (this.oldMailbox && this.oldMailbox.signature) {
          // update signature from old to new if signature is updated
          oldSig = this.oldMailbox.signature.slice(0, Math.max(0, this.oldMailbox.signature.length));
          if (this.selectedMailbox.signature) {
            newSig = this.selectedMailbox.signature.slice(0, Math.max(0, this.selectedMailbox.signature.length));
            content = content.replace(new RegExp(`${oldSig}$`), newSig);
          } else {
            content = content.replace(new RegExp(`${oldSig}$`), '');
          }
          this.composerEditorInstance?.setData(content);
        } else if (this.selectedMailbox && this.selectedMailbox.signature) {
          // add two lines and signature after message content with html format
          newSig = this.selectedMailbox.signature.slice(0, Math.max(0, this.selectedMailbox.signature.length));
          content = `<br>${newSig}${content}`;
          this.isSignatureAdded = true;
          this.composerEditorInstance?.setData(content);
        }
      }
    }
  }

  /**
   * Start Modal
   */
  openSelfDestructModal() {
    if (this.selfDestruct.value) {
      // reset to previous confirmed value
      this.selfDestruct = {
        ...this.selfDestruct,
        ...this.dateTimeUtilService.getNgbDateTimeStructsFromDateTimeStr(this.selfDestruct.value),
      };
    } else {
      this.resetSelfDestructValues();
    }
    this.selfDestructModalRef = this.modalService.open(this.selfDestructModal, {
      centered: true,
      windowClass: 'modal-sm users-action-modal',
    });
  }

  openDelayedDeliveryModal() {
    if (this.delayedDelivery.value) {
      // reset to previous confirmed value
      this.delayedDelivery = {
        ...this.delayedDelivery,
        ...this.dateTimeUtilService.getNgbDateTimeStructsFromDateTimeStr(this.delayedDelivery.value),
      };
    } else {
      this.resetDelayedDeliveryValues();
    }
    this.delayedDeliveryModalRef = this.modalService.open(this.delayedDeliveryModal, {
      centered: true,
      windowClass: 'modal-sm users-action-modal',
    });
  }

  openDeadManTimerModal() {
    if (!this.deadManTimer.value) {
      this.resetDeadManTimerValues();
    }
    this.deadManTimerModalRef = this.modalService.open(this.deadManTimerModal, {
      centered: true,
      windowClass: 'modal-sm users-action-modal',
    });
  }

  openEncryptionModal() {
    this.encryptForm.controls.password.setValue(this.encryptionData.password || '');
    this.encryptForm.controls.passwordHint.setValue(this.encryptionData.password_hint || '');
    this.encryptionModalRef = this.modalService.open(this.encryptionModal, {
      centered: true,
      windowClass: 'modal-md users-action-modal',
    });
  }

  closeEncryptionModal() {
    this.encryptionModalRef.dismiss();
  }
  /**
   * End Modal
   */

  /**
   * Start Self Destructive
   */
  setSelfDestructValue() {
    this.selfDestruct.error = null;
    if (this.selfDestruct.date && this.selfDestruct.time) {
      const dateTimeString = this.dateTimeUtilService.createDateTimeStrFromNgbDateTimeStruct(
        this.selfDestruct.date,
        this.selfDestruct.time,
      );
      this.selfDestructTimeString = dateTimeString;
      if (this.dateTimeUtilService.isDateTimeInPast(dateTimeString)) {
        this.selfDestruct.error = 'Selected datetime is in past.';
      } else {
        this.selfDestruct.value = dateTimeString;
        this.closeSelfDestructModal();
        this.clearDelayedDeliveryValue();
        this.clearDeadManTimerValue();
        this.valueChanged$.next(this.selfDestruct.value);
      }
    }
  }

  changeSelfDestruct() {
    if (this.selfDestruct.date && this.selfDestruct.time) {
      const dateTimeString = this.dateTimeUtilService.createDateTimeStrFromNgbDateTimeStruct(
        this.selfDestruct.date,
        this.selfDestruct.time,
      );
      this.selfDestructTimeString = dateTimeString;
    }
  }

  clearSelfDestructValue() {
    this.resetSelfDestructValues();
    this.closeSelfDestructModal();
    this.valueChanged$.next(this.selfDestruct.value);
  }
  /**
   * End Self Destructive
   */

  /**
   * Start Delayed Delivery
   */
  setDelayedDeliveryValue() {
    if (this.delayedDelivery.date && this.delayedDelivery.time) {
      const dateTimeString = this.dateTimeUtilService.createDateTimeStrFromNgbDateTimeStruct(
        this.delayedDelivery.date,
        this.delayedDelivery.time,
      );
      this.delayDeliverTimeString = dateTimeString;
      if (this.dateTimeUtilService.isDateTimeInPast(dateTimeString)) {
        this.delayedDelivery.error = 'Selected datetime is in past.';
      } else {
        this.delayedDelivery.value = dateTimeString;
        this.closeDelayedDeliveryModal();
        this.clearSelfDestructValue();
        this.clearDeadManTimerValue();
        this.valueChanged$.next(this.delayedDelivery.value);
      }
    }
  }

  changeDelayDeliver() {
    if (this.delayedDelivery.date && this.delayedDelivery.time) {
      const dateTimeString = this.dateTimeUtilService.createDateTimeStrFromNgbDateTimeStruct(
        this.delayedDelivery.date,
        this.delayedDelivery.time,
      );
      this.delayDeliverTimeString = dateTimeString;
    }
  }

  clearDelayedDeliveryValue() {
    this.resetDelayedDeliveryValues();
    this.closeDelayedDeliveryModal();
    this.valueChanged$.next(this.delayedDelivery.value);
  }
  /**
   * End Delayed Delivery
   */

  /**
   * Start DeadMan Timer
   */
  setDeadManTimerValue() {
    this.deadManTimer.days =
      !this.deadManTimer.days || Number.isNaN(this.deadManTimer.days) || this.deadManTimer.days < 0
        ? 0
        : Math.floor(this.deadManTimer.days);
    this.deadManTimer.hours =
      !this.deadManTimer.hours || Number.isNaN(this.deadManTimer.hours) || this.deadManTimer.hours < 0
        ? 0
        : Math.floor(this.deadManTimer.hours);
    this.deadManTimer.value = this.deadManTimer.days * 24 + this.deadManTimer.hours;
    this.closeDeadManTimerModal();
    if (this.deadManTimer.value) {
      this.clearSelfDestructValue();
      this.clearDelayedDeliveryValue();
    }
    this.valueChanged$.next(this.deadManTimer.value);
  }

  clearDeadManTimerValue() {
    this.resetDeadManTimerValues();
    this.closeDeadManTimerModal();
    this.valueChanged$.next(this.deadManTimer.value);
  }
  /**
   * End DeadMan Timer
   */

  /**
   * Start Password Encryption
   */
  onSubmitEncryption() {
    // Set password and expire date for message to non-ctemplar users
    this.showEncryptFormErrors = true;
    const { value, valid } = this.encryptForm;
    const expiryHours = value.hours + value.days * 24;
    if (valid && expiryHours > 0 && expiryHours <= 120) {
      this.encryptionData = {
        expiryHours,
        password: value.password,
        passwordHint: value.passwordHint,
      };
      this.valueChanged$.next(true);
      this.closeEncryptionModal();
    }
  }

  clearEncryption() {
    this.encryptForm.reset();
    this.encryptionData = {};
    this.valueChanged$.next(true);
  }
  /**
   * End Password Encryption
   */

  hasData() {
    if (
      this.mailData.receiver.length > 0 ||
      this.mailData.cc.length > 0 ||
      this.mailData.bcc.length > 0 ||
      this.mailData.subject.length > 0
    ) {
      return true;
    }
    if (!this.draftMail.is_html) {
      if (
        this.mailData.content.length > 1 &&
        this.mailData.content.replace(/(^[\t ]*\n)/gm, '') !== this.getPlainText(this.selectedMailbox.signature)
      ) {
        return true;
      }
    } else if (
      this.composerEditorInstance?.model?.hasContent(this.composerEditorInstance?.model.document.getRoot()) &&
      this.composerEditorInstance?.getData().replace(/(^[\t ]*\n)/gm, '') !==
        this.getPlainText(this.selectedMailbox.signature)
    ) {
      return true;
    }
    return false;
  }

  // Temporary Commenting
  // private embedImageInQuill(source: string, contentId?: string) {
  // if (source && this.quill) {
  //   const selection = this.quill.getSelection();
  //   const index = selection ? selection.index : this.quill.getLength();
  //   if (contentId === undefined) {
  //     this.quill.insertEmbed(index, 'image', source);
  //   } else {
  //     this.quill.insertEmbed(index, 'image', {
  //       url: source,
  //       content_id: contentId,
  //     });
  //   }
  //   this.quill.setSelection(index + 1);
  // }
  // }

  private updateEmail() {
    this.inProgress = true;
    this.setMailData(false, true);
    this.openPgpService.encrypt(this.draftMail.mailbox, this.draftId, new SecureContent(this.draftMail), []);
  }

  /**
   * Handle all compose contents and save to draft or send according to shouldSend and shouldSave
   */
  setMailData(shouldSend: boolean, shouldSave: boolean) {
    if (!this.draftMail) {
      this.draftMail = { is_html: null, content: null, folder: 'draft' };
    }
    if (this.draft) this.draft.isSaving = shouldSave;
    this.draftMail.mailbox = this.selectedMailbox ? this.selectedMailbox.id : null;
    this.draftMail.sender = this.selectedMailbox.email;
    this.draftMail.receiver = this.mailData.receiver.map((receiver: any) =>
      EmailFormatPipe.transformToFormattedEmail(receiver.email, receiver.name),
    );
    this.draftMail.receiver = this.draftMail.receiver.filter(receiver =>
      this.sharedService.isRFCStandardValidEmail(receiver),
    );
    this.draftMail.cc = this.mailData.cc.map((cc: any) => EmailFormatPipe.transformToFormattedEmail(cc.email, cc.name));
    this.draftMail.cc = this.draftMail.cc.filter(receiver => this.sharedService.isRFCStandardValidEmail(receiver));
    this.draftMail.bcc = this.mailData.bcc.map((bcc: any) =>
      EmailFormatPipe.transformToFormattedEmail(bcc.email, bcc.name),
    );
    this.draftMail.bcc = this.draftMail.bcc.filter(receiver => this.sharedService.isRFCStandardValidEmail(receiver));
    this.draftMail.subject = this.mailData.subject;
    this.draftMail.destruct_date = this.selfDestruct.value || null;
    this.draftMail.delayed_delivery = this.delayedDelivery.value || null;
    this.draftMail.dead_man_duration = this.deadManTimer.value || null;
    this.draftMail.is_subject_encrypted = true;
    this.draftMail.content = this.draftMail.is_html ? this.composerEditorInstance?.getData() : this.mailData.content;
    this.draftMail.send = shouldSend;

    if (this.action) {
      this.draftMail.last_action = this.action;
      this.draftMail.last_action_parent_id = this.action_parent;
    }

    if (this.forwardAttachmentsMessageId) {
      this.draftMail.forward_attachments_of_message = this.forwardAttachmentsMessageId;
      this.forwardAttachmentsMessageId = null;
    }
    if (this.parentId) {
      this.draftMail.parent = this.parentId;
    }
    if (this.encryptionData.password) {
      this.draftMail.encryption = this.draftMail.encryption || new EncryptionNonCTemplar();
      this.draftMail.encryption.password = this.encryptionData.password;
      this.draftMail.encryption.password_hint = this.encryptionData.passwordHint;
      this.draftMail.encryption.expiry_hours = this.encryptionData.expiryHours;
    } else if (this.draftMail.encryption) {
      this.draftMail.encryption = new EncryptionNonCTemplar();
    }

    // this.checkInlineAttachments();
    if (!shouldSend) {
      this.draftMail.folder = this.draftMail.folder ? this.draftMail.folder : MailFolderType.DRAFT;
      this.store.dispatch(
        new UpdateLocalDraft({
          ...this.draft,
          isMailDetailPage: this.isMailDetailPage,
          shouldSave,
          shouldSend,
          draft: { ...this.draftMail },
        }),
      );
    } else {
      this.store.dispatch(
        new UpdatePGPDecryptedContent({
          id: this.draftMail.id,
          isPGPInProgress: false,
          decryptedContent: { content: this.draftMail.content, subject: this.draftMail.subject },
        }),
      );
    }
  }

  // Temporary Commenting
  // checkInlineAttachments() {
  // const contents = this.quill.getContents().ops;
  // const currentAttachments: string[] = [];
  // contents.forEach((item: any) => {
  //   if (item.insert && item.insert.image && item.insert.image.content_id) {
  //     currentAttachments.push(item.insert.image.content_id);
  //   }
  // });
  // // inline attachments don't have attachment id
  // this.inlineAttachmentContentIds = this.inlineAttachmentContentIds.filter(contentId => {
  //   if (!currentAttachments.includes(contentId)) {
  //     const attachmentToRemove = this.attachments.find(attachment => attachment.content_id === contentId);
  //     if (attachmentToRemove) {
  //       this.removeAttachment(attachmentToRemove);
  //     }
  //     return false;
  //   }
  //   return true;
  // });
  // }

  private resetValues() {
    this.unSubscribeAutoSave();
    // this.firstSaveSubscription.unsubscribe();
    this.options = {};
    this.attachments = [];
    this.composerEditorInstance?.setData('');
    this.resetMailData();
    this.clearSelfDestructValue();
    this.clearDelayedDeliveryValue();
    this.clearDeadManTimerValue();
  }

  private closeSelfDestructModal() {
    if (this.selfDestructModalRef) {
      this.selfDestructModalRef.dismiss();
    }
  }

  private closeDelayedDeliveryModal() {
    if (this.delayedDeliveryModalRef) {
      this.delayedDeliveryModalRef.dismiss();
    }
  }

  private closeDeadManTimerModal() {
    if (this.deadManTimerModalRef) {
      this.deadManTimerModalRef.dismiss();
    }
  }

  private unSubscribeAutoSave() {
    if (this.autoSaveSubscription) {
      this.autoSaveSubscription.unsubscribe();
    }
  }

  private resetSelfDestructValues() {
    this.selfDestruct.value = undefined;
    this.selfDestruct.date = undefined;
    this.selfDestruct.time = {
      hour: 0,
      minute: 0,
      second: 0,
    };
    this.selfDestruct.meridian = true;
    this.selfDestruct.error = undefined;
  }

  private resetDelayedDeliveryValues() {
    this.delayedDelivery.value = undefined;
    this.delayedDelivery.date = undefined;
    this.delayedDelivery.time = {
      hour: 0,
      minute: 0,
      second: 0,
    };
    this.delayedDelivery.meridian = true;
    this.delayedDelivery.error = undefined;
  }

  private resetDeadManTimerValues() {
    this.deadManTimer.value = undefined;
    this.deadManTimer.days = 0;
    this.deadManTimer.hours = 0;
  }

  onFilesDrop(event: any) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files?.length === 1) {
      const acceptedImageTypes = ['image/gif', 'image/jpeg', 'image/png'];
      const fileType = event.dataTransfer?.files[0].type;
      if (fileType && acceptedImageTypes.includes(fileType)) {
        // Then, it's image
        this.onImagesSelected(event.dataTransfer?.files);
        return;
      }
    }
    this.onFilesSelected(event.dataTransfer.files);
  }

  onAddingReceiver(tag: any, data: any[]) {
    // convert tag values to custom format with value, display, email, name
    for (const item of data) {
      if (item.email) {
        item.display = item.email;
      } else if (item.value) {
        // TODO
        // should be updated for support group mailbox
        // in that case, the below line should be updated for cast into ParsedGroup as well
        const parsedEmail = parseEmail.parseOneAddress(item.value) as parseEmail.ParsedMailbox;
        if (parsedEmail) {
          item.name = parsedEmail.name || parsedEmail.local || '';
          item.value = parsedEmail.address || item.value;
          item.email = parsedEmail.address || item.value;
        } else {
          item.email = item.value;
          item.name = item.value;
        }
      }
    }
    const receiversForKey = data
      .filter(
        receiver =>
          !this.usersKeys.has(receiver.email.toLowerCase()) ||
          (!this.usersKeys.get(receiver.email.toLowerCase()).key &&
            !this.usersKeys.get(receiver.email.toLowerCase()).isFetching),
      )
      .map(receiver => receiver.email.toLowerCase());

    if (receiversForKey.length > 0) {
      this.store.dispatch(
        new GetUsersKeys({
          emails: receiversForKey,
        }),
      );
    }
    this.valueChanged$.next(data);
    this.analyzeUsersKeysWithContact();
    this.isSelfDestructionEnable();
  }

  /**
   * Analyze user key based on contact keys
   */
  analyzeUsersKeysWithContact(): void {
    if (!this.selectedMailbox) return;
    // Set Encryption Type with contacts
    const localReceivers: string[] = [
      ...this.mailData.receiver.map((receiver: any) => receiver.email),
      ...this.mailData.cc.map((cc: any) => cc.email),
      ...this.mailData.bcc.map((bcc: any) => bcc.email),
    ];
    // Check Autocrypt status
    this.autocryptInfo = this.autocryptService.decideAutocryptDefaultEncryption(
      this.selectedMailbox,
      localReceivers,
      this.usersKeys,
    );
    if (localReceivers.length > 0) {
      for (const rec of localReceivers) {
        const keyInfo = this.sharedService.parseUserKey(this.usersKeys, rec);
        if (keyInfo.isExistKey) {
          if (keyInfo.isCTemplarKey) {
            this.receiverEncryptTypeMap = {
              ...this.receiverEncryptTypeMap,
              [rec]: ComposerEncryptionType.COMPOSER_ENCRYPTION_TYPE_END_TO_END,
            };
          } else if (this.contactsState && this.contactsState.contacts.length > 0) {
            // Checking with contacts
            this.contactsState.contacts.forEach((contact: Contact) => {
              if (contact.email === rec && contact.enabled_encryption) {
                this.receiverEncryptTypeMap = {
                  ...this.receiverEncryptTypeMap,
                  [rec]: ComposerEncryptionType.COMPOSER_ENCRYPTION_TYPE_PGP_MIME_INLINE,
                };
              }
            });
          }
        } else {
          this.receiverEncryptTypeMap = {
            ...this.receiverEncryptTypeMap,
            [rec]: ComposerEncryptionType.COMPOSER_ENCRYPTION_TYPE_NONE,
          };
        }
      }
      if (!this.autocryptInfo.senderAutocryptEnabled) {
        // Set Editor style with encryption type
        // If all receiver is based on PGP Inline, Plain Text Editor
        // If PGP Mime or null, Do Nothing
        const isPGPInline = localReceivers.every(rec => {
          if (this.usersKeys.has(rec) && !this.usersKeys.get(rec).isFetching) {
            const contactInfo: Contact = this.contactsState?.contacts.find((contact: Contact) => contact.email === rec);
            if (contactInfo?.enabled_encryption && contactInfo?.encryption_type === PGPEncryptionType.PGP_INLINE) {
              return true;
            }
          }
          return false;
        });
        const isPGPMime = localReceivers.every(rec => {
          if (this.usersKeys.has(rec) && !this.usersKeys.get(rec).isFetching) {
            const contactInfo: Contact = this.contactsState.contacts.find((contact: Contact) => contact.email === rec);
            if (contactInfo?.enabled_encryption && contactInfo?.encryption_type === PGPEncryptionType.PGP_MIME) {
              return true;
            }
          }
          return false;
        });
        this.pgpEncryptionType = isPGPInline
          ? PGPEncryptionType.PGP_INLINE
          : isPGPMime
          ? PGPEncryptionType.PGP_MIME
          : null;
        if (this.pgpEncryptionType === PGPEncryptionType.PGP_INLINE && this.draftMail.is_html) {
          this.setHtmlEditor(false);
        } else if (this.pgpEncryptionType === PGPEncryptionType.PGP_MIME && !this.draftMail.is_html) {
          this.setHtmlEditor(true);
        }
      }
    }
  }

  // TODO should be moved to template
  getUserKeyFetchingStatus(email: string): boolean {
    return (
      !this.usersKeys.has(email.toLowerCase()) ||
      (this.usersKeys.has(email.toLowerCase()) && this.usersKeys.get(email.toLowerCase()).isFetching)
    );
  }

  onClickAttachPublicKey(isEnabled: boolean) {
    if (this.selectedMailbox) {
      this.selectedMailbox.is_attach_public_key = isEnabled;
      this.store.dispatch(new MailboxSettingsUpdate(this.selectedMailbox));
    }
  }

  onClickSignMessage(isEnabled: boolean) {
    if (this.selectedMailbox) {
      this.selectedMailbox.is_pgp_sign = isEnabled;
      this.store.dispatch(new MailboxSettingsUpdate(this.selectedMailbox));
    }
  }

  ngOnDestroy(): void {
    // save to draft when close compose
    if (this.selectedMailbox.email && !this.isMailSent && !this.isSavedInDraft && !this.saveDraftOnLogout) {
      this.saveInDrafts();
      this.isSavedInDraft = true;
    }
    if (this.isAuthenticated) {
      this.store.dispatch(new CloseMailbox(this.draft));
    }
  }
}
