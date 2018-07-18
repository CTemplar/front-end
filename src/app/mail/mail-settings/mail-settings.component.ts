import { Component, OnInit } from '@angular/core';
import { NgbDropdownConfig, NgbModal } from '@ng-bootstrap/ng-bootstrap';
// Store
import { Store } from '@ngrx/store';

import { BlackListDelete, SettingsUpdate, WhiteListDelete } from '../../store/actions';
import { AppState, MailBoxesState, Settings, Timezone, TimezonesState, UserState } from '../../store/datatypes';
import { Observable } from 'rxjs/Observable';
import { OnDestroy, TakeUntilDestroy } from 'ngx-take-until-destroy';
import { Language, LANGUAGES } from '../../shared/config';
import { Mailbox, UserMailbox } from '../../store/models';


@TakeUntilDestroy()
@Component({
  selector: 'app-mail-settings',
  templateUrl: './mail-settings.component.html',
  styleUrls: ['./mail-settings.component.scss']
})
export class MailSettingsComponent implements OnInit, OnDestroy {
  // == Defining public property as boolean
  selectedIndex = -1; // Assuming no element are selected initially
  userState: UserState;
  settings: Settings;
  selectedMailboxForKey: UserMailbox;
  publicKey: any;

  newListContact = { show: false, type: 'Whitelist' };

  readonly destroyed$: Observable<boolean>;
  selectedLanguage: Language;
  languages: Language[] = LANGUAGES;
  timezones: Timezone[];
  private mailboxes: Mailbox[];

  constructor(
    private modalService: NgbModal,
    config: NgbDropdownConfig,
    private store: Store<AppState>
  ) {
    // customize default values of dropdowns used by this component tree
    config.autoClose = true; // ~'outside';
  }

  ngOnInit() {
    this.store.select(state => state.user).takeUntil(this.destroyed$)
      .subscribe((user: UserState) => {
        this.userState = user;
        this.settings = user.settings;
        if (user.settings.language) {
          this.selectedLanguage = this.languages.filter(item => item.name === user.settings.language)[0];
        }
        if (this.userState.mailboxes.length > 0) {
          this.selectedMailboxForKey = this.userState.mailboxes[0];
        }
      });
    this.store.select(state => state.timezone).takeUntil(this.destroyed$)
      .subscribe((timezonesState: TimezonesState) => {
        this.timezones = timezonesState.timezones;
      });
    this.store.select(state => state.mailboxes).takeUntil(this.destroyed$)
      .subscribe((mailboxesState: MailBoxesState) => {
        this.mailboxes = mailboxesState.mailboxes;
        if (this.mailboxes.length > 0) {
          this.publicKey = 'data:application/octet-stream;charset=utf-8;base64,' + btoa(this.mailboxes[0].public_key);
        }
      });
  }

  // == Toggle active state of the slide in price page
  toggleSlides(index) {
    this.selectedIndex = index;
    document.querySelector('.package-xs-tab > li').classList.remove('active');
    document
      .querySelector('.package-prime-col')
      .classList.remove('active-slide');
  }

  // == Methods related to ngbModal

  // == Open change password NgbModal
  changePasswordModalOpen(passwordContent) {
    this.modalService.open(passwordContent, {
      centered: true,
      windowClass: 'modal-md'
    });
  }

  // == Open add custom filter NgbModal
  addCustomFilterModalOpen(customFilterContent) {
    this.modalService.open(customFilterContent, {
      centered: true,
      windowClass: 'modal-sm'
    });
  }

  // == Open billing information NgbModal
  billingInfoModalOpen(billingInfoContent) {
    this.modalService.open(billingInfoContent, {
      centered: true,
      windowClass: 'modal-lg'
    });
  }

  // == Open add new payment NgbModal
  newPaymentMethodModalOpen(newPaymentMethodContent) {
    this.modalService.open(newPaymentMethodContent, {
      centered: true,
      windowClass: 'modal-sm'
    });
  }

  // == Open make a donation NgbModal
  makeDonationModalOpen(makeDonationContent) {
    this.modalService.open(makeDonationContent, {
      centered: true,
      windowClass: 'modal-sm'
    });
  }

  // == Delete account NgbModal
  deleteAccountModalOpen(deleteAccountContent) {
    this.modalService.open(deleteAccountContent, {
        centered: true,
        windowClass: 'modal-sm'
    });
  }

  public deleteWhiteList(id) {
    this.store.dispatch(new WhiteListDelete(id));
  }

  public deleteBlackList(id) {
    this.store.dispatch(new BlackListDelete(id));
  }

  updateLanguage(language: Language) {
    this.settings.language = language.name;
    this.updateSettings();
  }

  updateSettings(key?: string, value?: any) {
    if (key) {
      if (this.settings[key] !== value) {
        this.settings[key] = value;
        this.store.dispatch(new SettingsUpdate(this.settings));
      }
    } else {
      this.store.dispatch(new SettingsUpdate(this.settings));
    }
  }

  ngOnDestroy(): void {
  }
}
