import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { debounceTime, distinctUntilChanged, take } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { ChangeEvent } from '@ckeditor/ckeditor5-angular';
import { TranslateService } from '@ngx-translate/core';

import * as DecoupledEditor from '../../../../assets/js/ckeditor-build/ckeditor';
import { SafePipe } from '../../../shared/pipes/safe.pipe';
import { MailSettingsService } from '../../../store/services/mail-settings.service';
import {
  AddMailboxKeys,
  DeleteMailboxKeys,
  MailboxSettingsUpdate,
  ResetMailboxKeyOperationState,
  SetMailboxKeyPrimary,
} from '../../../store/actions/mail.actions';
import { OpenPgpService, SharedService, UsersService } from '../../../store/services';
import { AppState, MailBoxesState, Settings, UserState, PGPKeyType, MailboxKey } from '../../../store/datatypes';
import { CreateMailbox, SetDefaultMailbox, SnackErrorPush, UpdateMailboxOrder } from '../../../store/actions';
import { Mailbox } from '../../../store/models';
import { PRIMARY_DOMAIN, PRIMARY_WEBSITE, CKEDITOR_TOOLBAR_ITEMS } from '../../../shared/config';
import { ImportPrivateKeyComponent } from '../../dialogs/import-private-key/import-private-key.component';

enum AddKeyStep {
  SELECT_MAILBOX,
  USER_PASSWORD,
}

@UntilDestroy()
@Component({
  selector: 'app-addresses-signature',
  templateUrl: './addresses-signature.component.html',
  styleUrls: ['./../mail-settings.component.scss', './addresses-signature.component.scss'],
})
export class AddressesSignatureComponent implements OnInit {
  @ViewChild('downloadKeyModal') downloadKeyModal: any;

  @ViewChild('setAutocryptConfirmModal') setAutocryptConfirmModal: any;

  @ViewChild('addNewKeyModal') addNewKeyModal: any;

  @ViewChild('deleteKeyConfirmModal') deleteKeyConfirmModal: any;

  @ViewChild('setPrimaryKeyConfirmModal') setPrimaryKeyConfirmModal: any;

  @ViewChild('downloadPrivateKeyRef') downloadPrivateKeyRef: any;

  @ViewChild('downloadPublicKeyRef') downloadPublicKeyRef: any;

  @ViewChild('manageMailboxModal') manageMailboxModal: any;

  private downloadKeyModalRef: NgbModalRef;

  private setAutocryptConfirmModalRef: NgbModalRef;

  private manageMailboxModalRef: NgbModalRef;

  private addNewKeyModalRef: NgbModalRef;

  private deleteKeyConfirmModalRef: NgbModalRef;

  private setPrimaryKeyConfirmModalRef: NgbModalRef;

  public mailBoxesState: MailBoxesState;

  public mailboxes: Mailbox[];

  public unmodifiedMailboxes: Mailbox[];

  public currentMailBox: Mailbox;

  public userState: UserState;

  public selectedMailboxPublicKey: string;

  public selectedMailboxPrivateKey: string;

  newAddressForm: FormGroup;

  newAddressOptions: any = {};

  selectedMailboxForSignature: Mailbox;

  selectedMailboxForManage: Mailbox;

  selectedMailboxForKey: Mailbox;

  settings: Settings;

  customDomains: string[];

  reorder: boolean;

  reorderInProgress = false;

  signatureChanged: Subject<string> = new Subject<string>();

  isCustomDomainSelected: boolean;

  aliasKeyExpandedStatus: Array<boolean> = [];

  selectedMailboxForAddNewKey: Mailbox;

  selectedKeyTypeForAddNewKey: PGPKeyType;

  isGeneratingKeys = false;

  mailboxKeyInProgress = false;

  mailboxKeysMap: Map<number, Array<MailboxKey>> = new Map();

  pickedMailboxKeyForUpdate: MailboxKey; // Download or Remove

  /**
   * This is temporary mailbox for
   * - Download, Remove on Multiple keys
   * - Manage Mailbox for auto Sign, auto attach public key
   */
  pickedMailboxForUpdate: MailboxKey; // Download or Remove - multiple keys

  selectedMailboxForAutocrypt: Mailbox;

  inProgress = false;

  primaryWebsite = PRIMARY_WEBSITE;

  userPassword: string;

  AddKeyStep = AddKeyStep;

  currentAddKeyStep: AddKeyStep = AddKeyStep.SELECT_MAILBOX;

  deleteKeyConfirmString: string;

  public DecoupledEditor = DecoupledEditor;

  public CKEDITOR_TOOLBAR_ITEMS = CKEDITOR_TOOLBAR_ITEMS;

  constructor(
    private formBuilder: FormBuilder,
    private openPgpService: OpenPgpService,
    private usersService: UsersService,
    private settingsService: MailSettingsService,
    private modalService: NgbModal,
    private store: Store<AppState>,
    private sharedService: SharedService,
    private translate: TranslateService,
  ) {}

  ngOnInit() {
    /**
     * Get current mailbox status and update selected mailbox
     */
    this.store
      .select(state => state.mailboxes)
      .pipe(untilDestroyed(this))
      .subscribe((mailboxesState: MailBoxesState) => {
        if (mailboxesState.isUpdatingOrder) {
          this.reorderInProgress = true;
          return;
        }
        if (this.reorderInProgress) {
          this.reorderInProgress = false;
          this.reorder = false;
        }
        if (
          this.mailBoxesState &&
          this.mailBoxesState.inProgress &&
          !mailboxesState.inProgress &&
          this.newAddressOptions.isBusy
        ) {
          this.onDiscardNewAddress();
        }
        this.mailBoxesState = mailboxesState;
        this.mailboxes = mailboxesState.mailboxes;
        if (this.mailboxes.length > 0) {
          if (this.aliasKeyExpandedStatus.length === 0) {
            this.aliasKeyExpandedStatus = Array.from({ length: this.mailboxes.length }, () => false);
          }
          this.currentMailBox = mailboxesState.currentMailbox;
          if (!this.selectedMailboxForSignature || this.selectedMailboxForSignature.id === this.currentMailBox.id) {
            // update selected mailbox in case `currentMailbox` has been updated
            this.selectedMailboxForSignature = mailboxesState.currentMailbox;
          }
          if (!this.selectedMailboxForKey || this.selectedMailboxForKey.id === this.currentMailBox.id) {
            // update selected mailbox in case `currentMailbox` has been updated
            this.onSelectedMailboxForKeyChanged(mailboxesState.currentMailbox);
          }
          if (this.mailboxKeyInProgress && !mailboxesState.mailboxKeyInProgress) {
            if (this.addNewKeyModalRef && !this.mailBoxesState.mailboxKeyFailure) {
              this.userPassword = '';
              this.addNewKeyModalRef.dismiss();
            }
            if (this.deleteKeyConfirmModalRef && !this.mailBoxesState.mailboxKeyFailure) {
              this.userPassword = '';
              this.deleteKeyConfirmModalRef.dismiss();
            }
            if (this.setPrimaryKeyConfirmModalRef) this.setPrimaryKeyConfirmModalRef.dismiss();
          }
        }
        this.mailboxKeyInProgress = mailboxesState.mailboxKeyInProgress;
        this.mailboxKeysMap = mailboxesState.mailboxKeysMap;
        if (this.inProgress && !mailboxesState.inProgress) {
          if (this.setAutocryptConfirmModalRef) {
            this.setAutocryptConfirmModalRef.dismiss();
          } else if (this.manageMailboxModalRef) {
            this.manageMailboxModalRef.dismiss();
          }
        }
        this.inProgress = mailboxesState.inProgress;
      });

    /**
     * Set customeDomains list from user's state
     */
    this.store
      .select(state => state.user)
      .pipe(untilDestroyed(this))
      .subscribe((user: UserState) => {
        this.userState = user;
        this.settings = user.settings;
        this.customDomains = user.customDomains
          .filter(item => item.is_domain_verified && item.is_mx_verified)
          .map(item => item.domain);
        this.customDomains = [PRIMARY_DOMAIN, ...this.customDomains];
      });

    this.newAddressForm = this.formBuilder.group({
      username: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[a-z]+([\da-z]*[._-]?[\da-z]+)+$/i),
          Validators.minLength(2),
          Validators.maxLength(64),
        ],
      ],
      domain: ['', Validators.required],
    });

    this.signatureChanged.pipe(debounceTime(3000), distinctUntilChanged()).subscribe(value => {
      this.updateMailboxSettings(this.selectedMailboxForSignature, 'signature', value);
    });

    this.handleUsernameAvailability();
  }

  public onSignatureReady(editor: any) {
    const toolbarContainer = document.querySelector('.signature-editor-toolbar-container');
    toolbarContainer.append(editor.ui.view.toolbar.element);
  }

  onDomainChange(customDomain: string) {
    this.newAddressForm.get('username').reset();
    if (customDomain !== PRIMARY_DOMAIN) {
      this.isCustomDomainSelected = true;
      this.newAddressForm
        .get('username')
        .setValidators([
          Validators.required,
          Validators.pattern(/^[a-z]*([\da-z]*[._-]?[\da-z]+)+$/i),
          Validators.minLength(1),
          Validators.maxLength(64),
        ]);
      this.newAddressForm.get('domain').setValidators([Validators.required]);
      this.newAddressForm.get('username').updateValueAndValidity();
    } else {
      this.isCustomDomainSelected = false;

      this.newAddressForm
        .get('username')
        .setValidators([
          Validators.required,
          Validators.pattern(/^[a-z]+([\da-z]*[._-]?[\da-z]+)+$/i),
          Validators.minLength(1),
          Validators.maxLength(64),
        ]);
      this.newAddressForm.get('domain').setValidators([Validators.required]);
      this.newAddressForm.get('username').updateValueAndValidity();
    }

    this.newAddressForm.get('domain').setValue(customDomain);
  }

  onAddNewAddress() {
    if (!this.newAddressOptions.isAddingNew) {
      this.newAddressForm.reset();
      this.newAddressForm.get('domain').setValue(PRIMARY_DOMAIN);
      this.newAddressOptions = {
        isAddingNew: true,
      };
    }
  }

  onDiscardNewAddress() {
    this.newAddressForm.reset();
    this.newAddressOptions = {
      isAddingNew: false,
    };
  }

  submitNewAddress() {
    this.newAddressOptions.isSubmitted = true;
    const newUserName = this.newAddressForm.controls.username.value;

    if (this.newAddressForm.valid && this.newAddressOptions.usernameExists === false && newUserName) {
      this.newAddressOptions.isBusy = true;
      const currentDomain = this.newAddressForm.controls.domain.value;
      if (currentDomain) {
        this.openPgpService.generateUserKeys(newUserName, atob(this.usersService.getUserKey()), currentDomain);
      } else {
        this.openPgpService.generateUserKeys(newUserName, atob(this.usersService.getUserKey()));
      }

      if (this.openPgpService.getUserKeys()) {
        this.addNewAddress();
      } else {
        this.openPgpService.waitForPGPKeys(this, 'addNewAddress', 'generateKeyFailed');
      }
    }
  }

  addNewAddress() {
    const requestData = {
      email: this.getEmail(),
      ...this.openPgpService.getUserKeys(),
    };
    this.store.dispatch(new CreateMailbox(requestData));
  }

  generateKeyFailed() {
    this.newAddressOptions.isBusy = false;
    this.store.dispatch(new SnackErrorPush({ message: this.translate.instant('create_account.failed_generate_code') }));
  }

  updateDefaultEmailAddress(selectedMailbox: Mailbox) {
    this.store.dispatch(new SetDefaultMailbox(selectedMailbox));
  }

  onSelectedMailboxForKeyChanged(mailbox: Mailbox) {
    this.selectedMailboxForKey = mailbox;
    this.selectedMailboxPublicKey = `data:application/octet-stream;charset=utf-8;base64,${btoa(
      this.selectedMailboxForKey.public_key,
    )}`;
    this.selectedMailboxPrivateKey = `data:application/octet-stream;charset=utf-8;base64,${btoa(
      this.selectedMailboxForKey.private_key,
    )}`;
  }

  onSignatureChange({ editor }: ChangeEvent) {
    this.signatureChanged.next(editor.getData());
  }

  updateMailboxSettings(selectedMailbox: any, key: string, value: any) {
    if (selectedMailbox[key] !== value) {
      selectedMailbox.inProgress = true;
      // Sanitizing for signature & display_name
      if (key === 'signature' || key === 'display_name') {
        value = SafePipe.processSanitization(value, false);
      }
      this.store.dispatch(new MailboxSettingsUpdate({ ...selectedMailbox, [key]: value }));
    }
  }

  sortDown(index: number) {
    const sortOrder = this.mailboxes[index].sort_order;
    this.mailboxes[index].sort_order = this.mailboxes[index + 1].sort_order;
    this.mailboxes[index + 1].sort_order = sortOrder;
    this.mailboxes.sort((a, b) => {
      return a.sort_order - b.sort_order;
    });
  }

  sortUp(index: number) {
    const sortOrder = this.mailboxes[index].sort_order;
    this.mailboxes[index].sort_order = this.mailboxes[index - 1].sort_order;
    this.mailboxes[index - 1].sort_order = sortOrder;
    this.mailboxes.sort((a, b) => {
      return a.sort_order - b.sort_order;
    });
  }

  startReorder() {
    this.reorder = true;
    this.unmodifiedMailboxes = this.mailboxes.map(x => ({ ...x }));
    this.mailboxes = this.mailboxes
      .sort((a, b) => {
        return a.sort_order - b.sort_order;
      })
      .map((item, index) => {
        item.sort_order = index + 1;
        return item;
      });
  }

  saveOrder() {
    this.reorderInProgress = true;
    const payload: any = {
      mailboxes: this.mailboxes,
      data: {
        mailbox_list: this.mailboxes.map(item => {
          return { mailbox_id: item.id, sort_order: item.sort_order };
        }),
      },
    };
    this.store.dispatch(new UpdateMailboxOrder(payload));
  }

  cancelOrder() {
    this.reorder = false;
    this.mailboxes = this.unmodifiedMailboxes;
  }

  private getEmail() {
    return (
      this.newAddressForm.controls.username.value +
      (this.newAddressForm.controls.domain.value === PRIMARY_DOMAIN
        ? ''
        : `@${this.newAddressForm.controls.domain.value}`)
    );
  }

  private handleUsernameAvailability() {
    this.newAddressForm
      .get('username')
      .valueChanges.pipe(debounceTime(500), untilDestroyed(this))
      .subscribe(username => {
        if (!username) {
          return;
        }
        if (!this.newAddressForm.controls.username.errors) {
          this.newAddressOptions.isBusy = true;
          this.usersService.checkUsernameAvailability(this.getEmail()).subscribe(
            response => {
              this.newAddressOptions.usernameExists = response.exists;
              this.newAddressOptions.isBusy = false;
            },
            error => {
              this.store.dispatch(
                new SnackErrorPush({ message: `Failed to check username availability. ${error.error}` }),
              );
              this.newAddressOptions.isBusy = false;
              this.newAddressOptions.usernameExists = null;
            },
          );
        }
      });
  }

  updateSettings(key?: string, value?: any) {
    this.settingsService.updateSettings(this.settings, key, value);
  }

  onDownloadKey(key: MailboxKey, mailbox: Mailbox) {
    this.pickedMailboxKeyForUpdate = key;
    this.pickedMailboxForUpdate = mailbox;
    this.selectedMailboxPublicKey = `data:application/octet-stream;charset=utf-8;base64,${btoa(key.public_key)}`;
    this.selectedMailboxPrivateKey = `data:application/octet-stream;charset=utf-8;base64,${btoa(key.private_key)}`;
    this.downloadKeyModalRef = this.modalService.open(this.downloadKeyModal, {
      centered: true,
      backdrop: 'static',
      windowClass: 'modal-sm',
    });
  }

  /**
   * Start Delete Key Section
   */

  onRemoveKey(key: MailboxKey) {
    this.deleteKeyConfirmString = '';
    this.store.dispatch(new ResetMailboxKeyOperationState());
    this.pickedMailboxKeyForUpdate = key;
    this.deleteKeyConfirmModalRef = this.modalService.open(this.deleteKeyConfirmModal, {
      centered: true,
      backdrop: 'static',
      windowClass: 'modal-sm',
    });
  }

  onConfirmDeleteKey() {
    if (this.pickedMailboxKeyForUpdate && this.userPassword) {
      const password = this.sharedService.getHashPurePasswordWithUserName(this.userPassword);
      this.store.dispatch(new DeleteMailboxKeys({ ...this.pickedMailboxKeyForUpdate, password }));
    }
  }
  /**
   * End Delete Key Section
   */

  /**
   * Start Set Primary Key Section
   */
  onSetPrimary(key: MailboxKey) {
    this.pickedMailboxKeyForUpdate = key;
    this.setPrimaryKeyConfirmModalRef = this.modalService.open(this.setPrimaryKeyConfirmModal, {
      centered: true,
      backdrop: 'static',
      windowClass: 'modal-sm',
    });
  }

  onConfirmSetPrimaryKey() {
    if (this.pickedMailboxKeyForUpdate) {
      this.store.dispatch(new SetMailboxKeyPrimary(this.pickedMailboxKeyForUpdate));
    }
  }
  /**
   * End Set Primary Key Section
   */

  /**
   * Start Manage Mailbox Section
   */
  onManageMailbox(mailbox: Mailbox) {
    this.selectedMailboxForManage = mailbox;
    this.manageMailboxModalRef = this.modalService.open(this.manageMailboxModal, {
      centered: true,
      backdrop: 'static',
      windowClass: 'modal-sm',
    });
  }

  onClickAttachPublicKey(isEnabled: boolean) {
    if (this.selectedMailboxForManage) {
      this.selectedMailboxForManage.is_attach_public_key = isEnabled;
    }
  }

  onClickSignMessage(isEnabled: boolean) {
    if (this.selectedMailboxForManage) {
      this.selectedMailboxForManage.is_pgp_sign = isEnabled;
    }
  }

  onConfirmSetManageMailbox() {
    if (this.selectedMailboxForManage) {
      this.store.dispatch(new MailboxSettingsUpdate(this.selectedMailboxForManage));
    }
  }

  /**
   * End Manage Mailbox Section
   */

  /**
   * Start Autocrypt Section
   */
  onSetAutocrypt(mailbox: Mailbox) {
    this.selectedMailboxForAutocrypt = mailbox;
    this.setAutocryptConfirmModalRef = this.modalService.open(this.setAutocryptConfirmModal, {
      centered: true,
      backdrop: 'static',
      windowClass: 'modal-sm',
    });
  }

  onConfirmSetAutocrypt() {
    if (this.selectedMailboxForAutocrypt) {
      this.store.dispatch(new MailboxSettingsUpdate(this.selectedMailboxForAutocrypt));
    }
  }

  onClickAutocrypt(isAutocrypt: boolean) {
    this.selectedMailboxForAutocrypt.is_autocrypt_enabled = isAutocrypt;
  }
  /**
   * End Autocrypt Section
   */

  /**
   * Start Add Mailbox Key Section
   */
  onAddNewKey() {
    this.userPassword = '';
    this.currentAddKeyStep = AddKeyStep.SELECT_MAILBOX;
    this.store.dispatch(new ResetMailboxKeyOperationState());
    if (this.mailboxes && this.mailboxes.length > 0) {
      [this.selectedMailboxForAddNewKey] = this.mailboxes;
    }
    this.selectedKeyTypeForAddNewKey = PGPKeyType.ECC;
    this.addNewKeyModalRef = this.modalService.open(this.addNewKeyModal, {
      centered: true,
      backdrop: 'static',
      windowClass: 'modal-sm',
    });
  }

  onSelectMailboxForAddNewKey(mailbox: Mailbox) {
    this.selectedMailboxForAddNewKey = mailbox;
  }

  onNextAddKey() {
    if (this.currentAddKeyStep === AddKeyStep.SELECT_MAILBOX) {
      this.currentAddKeyStep += 1;
    } else if (this.userPassword) {
      this.onGenerateKeys();
    }
  }

  onGenerateKeys() {
    if (!this.selectedKeyTypeForAddNewKey || !this.selectedMailboxForAddNewKey || this.isGeneratingKeys) {
      return;
    }
    this.isGeneratingKeys = true;
    this.openPgpService
      .generateUserKeysWithEmail(
        this.selectedMailboxForAddNewKey.email,
        atob(this.usersService.getUserKey()),
        this.selectedKeyTypeForAddNewKey,
      )
      .pipe(take(1))
      .subscribe(
        keys => {
          const keyDataKeydata = { ...keys };
          this.isGeneratingKeys = false;
          keyDataKeydata.key_type = this.selectedKeyTypeForAddNewKey === PGPKeyType.RSA_4096 ? 'RSA4096' : 'ECC';
          keyDataKeydata.mailbox = this.selectedMailboxForAddNewKey.id;
          if (
            !this.mailboxKeysMap.has(this.selectedMailboxForAddNewKey.id) ||
            this.mailboxKeysMap.get(this.selectedMailboxForAddNewKey.id).length === 0
          ) {
            keyDataKeydata.is_primary = true;
          }
          keyDataKeydata.password = this.sharedService.getHashPurePasswordWithUserName(this.userPassword);
          this.store.dispatch(new AddMailboxKeys(keyDataKeydata));
        },
        error => {
          this.isGeneratingKeys = false;
          this.store.dispatch(new SnackErrorPush({ message: error }));
        },
      );
  }
  /**
   * End Add Mailbox Key Section
   */

  // == Open NgbModal
  onImportKey() {
    const options: any = {
      centered: true,
      backdrop: 'static',
      windowClass: 'modal-sm import-private-key-modal',
    };
    const component = this.modalService.open(ImportPrivateKeyComponent, options).componentInstance;
    component.mailboxes = this.mailboxes;
  }

  // == Toggle password visibility
  togglePassword(inputID: string): any {
    const input = <HTMLInputElement>document.querySelector(`#${inputID}}`);
    if (!input.value) {
      return;
    }
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}
