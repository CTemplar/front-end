import { Subscription } from 'rxjs';

import { MailAction, PGPEncryptionType } from '../datatypes';

export interface Mail {
  id?: number;
  attachments?: Array<any>;
  bcc_display?: Array<EmailDisplay>;
  bcc?: Array<string>;
  cc?: Array<string>;
  cc_display?: Array<EmailDisplay>;
  checked?: boolean;
  children_count?: number;
  children?: Array<Mail>;
  content: string;
  content_plain?: string;
  created_at?: string;
  datetime?: string;
  dead_man_duration?: string;
  delayed_delivery?: string;
  destruct_date?: string;
  encryption?: EncryptionNonCTemplar;
  folder?: string;
  forward_attachments_of_message?: number;
  from?: string;
  has_attachments?: boolean;
  has_children?: boolean;
  incoming_headers?: string;
  is_encrypted?: boolean;
  is_html?: boolean;
  is_protected?: boolean;
  is_verified?: boolean;
  is_subject_encrypted?: boolean;
  last_action_parent_id?: number;
  last_action_thread?: MailAction;
  last_action?: MailAction;
  mailbox?: number;
  marked?: boolean;
  parent?: number;
  read?: boolean;
  receiver_display?: Array<EmailDisplay>;
  receiver_list?: string;
  receiver?: Array<string>;
  reply_to?: Array<string>;
  send?: boolean;
  sender_display_name?: string;
  sender_display?: EmailDisplay;
  sender?: string;
  sent_at?: string;
  spam_reason?: string | [];
  starred?: boolean;
  subject?: string;
  thread_count?: number;
  children_folder_info?: any;
  has_starred_children?: boolean;
  is_autocrypt_encrypted?: boolean;
  encryption_type?: PGPEncryptionType;
  reply_to_display?: Array<EmailDisplay>;
  email_display_name_map?: any;
  sign?: string;
}

export class EncryptionNonCTemplar {
  id?: number;

  expires?: string;

  expiry_hours = 120;

  password_hint?: string;

  password: string;

  random_secret?: string;
}

export interface Mailbox {
  id?: number;
  display_name?: string;
  email: string;
  fingerprint?: string;
  folders: string[];
  inProgress?: boolean;
  is_active?: boolean;
  is_default?: boolean;
  is_enabled?: boolean;
  messages: string[];
  private_key: string;
  public_key: string;
  signature?: string;
  sort_order: number;
  key_type: string;
  // Autocrypt settings
  is_autocrypt_enabled?: boolean;
  prefer_encrypt?: string;
  is_attach_public_key?: boolean;
  is_pgp_sign?: boolean;
}

export interface Folder {
  id?: number;
  name: string;
  color: string;
  sort_order?: number;
}

export enum MailFolderType {
  ALL_EMAILS = 'allmails',
  UNREAD = 'allunreadmails',
  INBOX = 'inbox',
  SENT = 'sent',
  DRAFT = 'draft',
  STARRED = 'starred',
  ARCHIVE = 'archive',
  SPAM = 'spam',
  TRASH = 'trash',
  OUTBOX = 'outbox',
  SEARCH = 'search',
}

export interface Attachment {
  id?: number;
  attachmentId?: number;
  content_id?: string;
  decryptedDocument?: File;
  document: any;
  draftId: number;
  inProgress: boolean;
  is_encrypted?: boolean;
  is_forwarded?: boolean;
  is_inline: boolean;
  isRemoved?: boolean;
  message: number;
  name: string;
  progress?: number;
  request?: Subscription;
  size: string;
  actual_size?: number;
  is_pgp_mime?: boolean;
}

export interface EmailDisplay {
  email: string;
  name?: string;
  is_deleted?: boolean;
  is_encrypted?: boolean;
  enabled_encryption?: boolean;
  starred: boolean;
}

export interface PGPMimeMessageProgressModel {
  content?: string;
  attachments?: Attachment[];
  encrypted_content?: string;
  encrypted_attachments?: Map<number, string>; // Map<attachmentId, encrypted_content>
}

export enum ContactFolderType {
  ALL_CONTACTS = 'allContacts',
  STARRED = 'starred',
}

export interface Unsubscribe {
  mailbox_id: number;
  mailto: string;
}

export interface AdvancedSearchQueryParameters {
  q?: string;
  exact?: boolean;
  folder?: string;
  sender?: string;
  receiver?: string;
  have_attachment?: boolean;
  start_date?: string;
  end_date?: string;
  size?: number;
  size_operator?: string;
}
