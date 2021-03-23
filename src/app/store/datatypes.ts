import { Params } from '@angular/router';

import { Attachment, Mail, Mailbox, MailFolderType, Membership, User, UserMailbox } from './models';
import { Filter } from './models/filter.model';
import { SearchState } from './reducers/search.reducers';
import { Folder } from './models/mail.model';
import { WebSocketState } from './websocket.store';
import { OrganizationState } from './organization.store';

export interface RouterStateUrl {
  url: string;
  queryParams: Params;
  params: Params;
  state: any;
}

export interface AuthState {
  // is a user authenticated?
  isAuthenticated: boolean;
  // if authenticated, there should be a user object
  user: User | null;
  // error message
  errorMessage: string | null;
  inProgress: boolean;
  signupState: SignupState;
  isRecoveryCodeSent: boolean;
  resetPasswordErrorMessage: string | null;
  updatedPrivateKeys?: any;
  isChangePasswordError?: boolean;
  captcha?: Captcha;
  auth2FA?: Auth2FA;
  anti_phishing_phrase?: string;
  recovery_key?: string;
  saveDraftOnLogout?: boolean;
}

export interface CardState {
  id: string | null;
  brand: string | null;
  country: string | null;
  exp_month: number;
  exp_year: number;
  last4: string | null;
  is_primary: boolean;
}

export class Auth2FA {
  secret?: string;

  secret_url?: string;

  inProgress?: boolean;

  is_2fa_enabled?: boolean;

  show2FALogin?: boolean;

  constructor(data?: any) {
    if (data) {
      this.inProgress = data.inProgress;
      this.secret = data.secret;
      this.secret_url = encodeURIComponent(data.secret_url);
    }
  }
}

export interface Captcha {
  captcha_image?: string;
  captcha_key?: string;
  value?: string;
  inProgress?: boolean;
  isInvalid?: boolean;
  verified?: boolean;
}

export interface SignupState {
  username?: string;
  password?: string;
  recovery_email?: string;
  usernameExists?: boolean;
  inProgress?: boolean;
  recaptcha: string;
  public_key?: string;
  private_key?: string;
  fingerprint?: string;
  plan_type?: PlanType;
  payment_type?: PaymentType;
  payment_method?: PaymentMethod;
  currency?: string;
  memory?: number;
  email_count?: number;
  domain_count?: number;
  monthlyPrice?: number;
  annualPricePerMonth?: number;
  annualPriceTotal?: number;
}

export class UserState {
  username: string | null;

  id: number | null;

  whiteList: WhiteList[];

  blackList: BlackList[];

  settings: Settings;

  payment_transaction?: Payment;

  isPrime?: boolean;

  joinedDate?: string;

  inProgress?: boolean;

  isError?: boolean;

  error?: string;

  membership: Membership;

  mailboxes: UserMailbox[];

  customFolders: Folder[];

  filters: Filter[];

  filtersError?: any;

  autoresponder?: AutoResponder;

  customDomains: Domain[];

  customDomainsLoaded?: boolean;

  newCustomDomain?: Domain;

  newCustomDomainError?: string;

  currentCreationStep: number;

  isForwardingVerificationCodeSent?: boolean;

  emailForwardingErrorMessage?: string;

  autoResponderErrorMessage?: string;

  isLoaded?: boolean;

  invoices: Invoice[];

  isInvoiceLoaded?: boolean;

  upgradeAmount?: number;

  promoCode: PromoCode;

  inviteCodes: InviteCode[];

  has_notification?: boolean;

  notifications?: any;

  cards?: Array<CardState>;
}

export interface InviteCode {
  expiration_date: string;
  is_used: boolean;
  code: string;
}

export class PromoCode {
  is_valid: boolean = null;

  discount_amount?: number;

  new_amount: number = null;

  new_amount_btc: number = null;

  message?: string;

  value = '';

  enabled = false;

  inProgress = false;
}

export interface ContactsState {
  contacts: Contact[];
  totalContacts: number;
  inProgress?: boolean;
  isError?: boolean;
  emailContacts?: EmailContact[];
  noOfDecryptedContacts: number;
  contactsToDecrypt: Contact[];
  loaded: boolean;
}

export interface EmailContact {
  name: string;
  email: string;
}

export class Settings {
  id?: number;

  emails_per_page?: number;

  embed_content?: boolean;

  newsletter?: boolean;

  recovery_email?: string;

  save_contacts?: boolean;

  show_snippets?: boolean;

  timezone?: string;

  language?: string;

  signature?: string;

  allocated_storage?: number;

  used_storage?: number;

  display_name?: string;

  email_count?: number;

  domain_count?: number;

  default_font?: string;

  autosave_duration?: string;

  enable_forwarding?: boolean;

  enable_copy_forwarding?: boolean;

  forwarding_address?: string;

  plan_type?: PlanType;

  notification_email?: string;

  recurrence_billing?: boolean;

  is_attachments_encrypted?: boolean;

  enable_2fa?: boolean;

  is_contacts_encrypted?: boolean;

  is_anti_phishing_enabled?: boolean;

  anti_phishing_phrase?: string;

  is_html_disabled?: boolean;

  attachment_size_limit?: number;

  attachment_size_error?: string;

  is_composer_full_screen?: boolean;

  is_night_mode?: boolean;

  is_conversation_mode?: boolean;

  is_enable_report_bugs?: boolean;

  include_original_message?: boolean;

  custom_css?: string;

  is_disable_loading_images?: boolean;

  is_subject_auto_decrypt?: boolean;
}

export interface Invoice {
  id: number;
  invoice_id: number;
  invoice_date: Date;
  plan_type: PlanType;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  total_amount: number;
  total_amount_btc?: number;
  custom_domains: number;
  email_addresses: number;
  storage: number;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  description?: string;
  quantity: number;
  amount: number;
  amount_btc?: number;
  type: string;
}

export interface AutoResponder {
  id?: number;
  is_time_range_restricted?: boolean;
  start_time?: string;
  end_time?: string;
  autoresponder_message?: string;
  autoresponder_active?: boolean;
  start_date?: string;
  end_date?: string;
  vacationautoresponder_message?: string;
  vacationautoresponder_active?: boolean;
  only_contacts?: boolean;
}

export class Payment {
  id?: number;

  transaction_id?: string;

  amount?: number;

  currency?: string;

  created?: string;

  billing_cycle_ends?: string;

  payment_method?: PaymentMethod;

  payment_type?: PaymentType;
}

export interface MailState {
  mails: Mail[];
  total_mail_count: number;
  mailDetail: Mail;
  currentFolder?: MailFolderType;
  loaded?: boolean;
  inProgress?: boolean;
  decryptedContents: DecryptedContentState;
  decryptedSubjects: any;
  unreadMailsCount: any;
  customFolderMessageCount: any;
  noUnreadCountChange: boolean;
  mailDetailLoaded?: boolean;
  canGetUnreadCount: boolean;
  starredFolderCount: number;
  isMailsMoved?: boolean;
  isComposerPopUp?: boolean;
  currentSettingsTab?: string;

  mailMap: any;
  folderMap: Map<string, FolderState>;
  pageLimit?: number;
}

export interface FolderState {
  mails: Array<number>;
  total_mail_count: number;
  is_not_first_page: boolean;
  offset: number;
  is_dirty: boolean;
}

export class SecureContent {
  id?: number;

  content: string;

  content_plain?: string;

  incomingHeaders?: string;

  subject?: string;

  inProgress?: boolean;

  isSubjectEncrypted?: boolean;

  parent?: number;

  constructor(data?: Mail) {
    if (data) {
      this.content = data.content;
      this.content_plain = data.content_plain;
      this.subject = data.subject;
      this.incomingHeaders = data.incoming_headers;
      this.isSubjectEncrypted = data.is_subject_encrypted;
      this.parent = data.parent;
    }
  }
}

export interface DecryptedContentState {
  [key: number]: SecureContent;
}

export interface Draft {
  id: number;
  draft: Mail;
  inProgress?: boolean;
  encryptedContent?: SecureContent;
  decryptedContent?: string;
  isPGPInProgress?: boolean;
  // isSshInProgress?: boolean;
  attachments: Attachment[];
  shouldSend?: boolean;
  shouldSave?: boolean;
  getUserKeyInProgress?: boolean;
  usersKeys?: UserKey;
  isMailDetailPage?: boolean;
  isSent?: boolean;
  isSaving?: boolean;
  /**
   * @var isProcessingAttachments
   * @description It represents if any of the attachments is being processed (encrypting/uploading).
   */
  isProcessingAttachments?: boolean;

  /**
   * @var isClosed
   * @description It represents if the compose mail editor has been closed or not.
   */
  isClosed?: boolean;
}

export interface DraftState {
  [key: number]: Draft;
}

export interface ComposeMailState {
  drafts: DraftState;
  usersKeys?: Map<string, GlobalPublicKey>;
  getUserKeyEveryInProgress?: boolean;
}

export interface GlobalPublicKey {
  isFetching: boolean;
  key: PublicKey;
}

export interface MailBoxesState {
  mailboxes: Mailbox[];
  currentMailbox: Mailbox;
  decryptKeyInProgress: boolean;
  decryptedKey?: any;
  encryptionInProgress: boolean;
  inProgress?: boolean;
  isUpdatingOrder?: boolean;
}

export interface SecureMessageState {
  decryptedContent?: SecureContent;
  decryptedKey?: any;
  encryptedContent?: string;
  errorMessage?: string;
  getUserKeyInProgress?: boolean;
  inProgress?: boolean;
  isContentDecryptionInProgress?: boolean;
  isEncryptionInProgress?: boolean;
  isKeyDecryptionInProgress?: boolean;
  message: Mail;
  usersKeys?: PublicKey[];
}

export interface UserKey {
  encrypt: boolean;
  keys: PublicKey[];
}

export interface PublicKey {
  email: string;
  is_enabled: boolean;
  public_key: string;
}

export interface LoadingState {
  RecentBlogLoading: boolean | true;
  RelatedBlogLoading: boolean | true;
  Loading: boolean | true;
}

export interface KeyboardState {
  keyboardFocused: boolean;
  keyPressed: {
    key: string;
  };
  focusedInput: string;
}

export interface WhiteList {
  id?: number;
  email: string;
  name: string;
}

export interface BlackList {
  id?: number;
  email: string;
  name: string;
}

export interface Contact {
  id?: number;
  address?: string;
  email?: string;
  enabled_encryption?: boolean;
  encrypted_data?: string;
  extra_emails?: Array<string>;
  extra_phones?: Array<string>;
  is_decryptionInProgress?: boolean;
  is_encrypted?: boolean;
  isDecryptedFrontend?: boolean; // If the contact is decrypted on frontend or not
  markForDelete?: boolean; // To handle delete multiple contacts using checkboxes
  name?: string;
  note?: string;
  phone?: string;
  phone2?: string;
  provider?: string;
  public_key?: string;
}

export interface AppState {
  auth: AuthState;
  bitcoin: BitcoinState;
  composeMail: ComposeMailState;
  contacts: ContactsState;
  keyboard: KeyboardState;
  loading: LoadingState;
  mail: MailState;
  mailboxes: MailBoxesState;
  organization: OrganizationState;
  search: SearchState;
  secureMessage: SecureMessageState;
  timezone: TimezonesState;
  user: UserState;
  webSocket: WebSocketState;
}

export interface TimezonesState {
  timezones: Timezone[];
}

export interface Timezone {
  value: string;
  key: string;
}

export interface BitcoinState {
  bitcoinRequired: number;
  newWalletAddress: string;
  loaded: boolean;
  checkTransactionResponse: CheckTransactionResponse;
}

export interface CheckTransactionResponse {
  address?: string;
  balance?: number;
  confirmed?: boolean;
  paid_out?: number;
  pending_balance?: number;
  required_balance?: number;
  status: TransactionStatus;
}

export interface DomainRecord {
  host: string;
  priority?: number;
  type: string;
  value: string;
}

export interface Domain {
  id: number;
  catch_all?: boolean;
  catch_all_email?: string;
  created: string;
  dkim_record: DomainRecord;
  dmarc_record: DomainRecord;
  domain: string;
  is_dkim_verified: boolean;
  is_dmarc_verified: boolean;
  is_domain_verified: boolean;
  is_mx_verified: boolean;
  is_spf_verified: boolean;
  mx_record: DomainRecord;
  number_of_aliases?: number;
  number_of_users?: number;
  spf_record: DomainRecord;
  verification_record: DomainRecord;
  verified_at?: string;
}

export interface PricingPlan {
  aliases: number;
  annually_price: number;
  anti_phishing: boolean;
  attachment_upload_limit: number;
  background: string;
  brute_force_protection: boolean;
  catch_all_email: boolean;
  checksums: boolean;
  custom_domains: number;
  dead_man_timer: boolean;
  delayed_delivery: boolean;
  domain_count: number;
  email_count: number;
  encrypted_attachments: boolean;
  encryption_at_rest: boolean;
  encrypted_body: boolean;
  encrypted_contacts: boolean;
  encrypted_content: boolean;
  encrypted_metadata: boolean;
  encrypted_subjects: boolean;
  exclusive_access: boolean;
  four_data_deletion_methods: boolean;
  gb: number;
  messages_per_day: number | string;
  monthly_price: number;
  multi_user_support: boolean;
  name: PlanType;
  self_destructing_emails: boolean;
  sri: boolean;
  ssl_tls: boolean;
  storage: number;
  strip_ips: boolean;
  two_fa: boolean;
  unlimited_folders: boolean;
  virus_detection_tool: boolean;
  anonymized_ip: boolean;
  zero_knowledge_password: boolean;
  remote_encrypted_link: boolean;
}

export enum TransactionStatus {
  PENDING = 'Pending',
  RECEIVED = 'Received',
  SENT = 'Sent',
  WAITING = 'Waiting',
}

export enum PaymentMethod {
  bitcoin = 'bitcoin',
  BITCOIN = 'Bitcoin',
  stripe = 'stripe',
  STRIPE = 'Stripe',
  monero = 'monero',
  MONERO = 'Monero',
}

export enum PaymentType {
  MONTHLY = 'monthly',
  ANNUALLY = 'annually',
}

export enum PlanType {
  FREE = 'FREE',
  PRIME = 'PRIME',
  KNIGHT = 'KNIGHT',
  MARSHAL = 'MARSHALL',
  PARAGON = 'PARAGON',
  CHAMPION = 'CHAMPION',
}

export enum NotificationPermission {
  DEFAULT = 'default',
  GRANTED = 'granted',
  DENIED = 'denied',
}

export enum MailAction {
  REPLY = 'REPLY',
  REPLY_ALL = 'REPLY_ALL',
  FORWARD = 'FORWARD',
}

export type NumberBooleanMappedType = {
  [key: number]: boolean;
};

export type NumberStringMappedType = {
  [key: number]: string;
};

export interface ImportContactResponse {
  detail?: string;
  success_count?: number;
  fail_count?: number;
}
