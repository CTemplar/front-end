import { Component, Inject, ChangeDetectionStrategy, OnInit, ViewChild } from '@angular/core';
import { NgbDropdownConfig, NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FormControl } from '@angular/forms';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { ComposeMailService } from '../../store/services/compose-mail.service';
import { Language, LANGUAGES, PRIMARY_WEBSITE } from '../../shared/config';
import { ExpireSession, Logout, SaveDraftOnLogout } from '../../store';
import { AppState, UserState } from '../../store/datatypes';
import { LOADING_IMAGE, HttpCancelService, ElectronService } from '../../store/services';
import { ThemeToggleService } from '../../shared/services/theme-toggle-service';

@UntilDestroy()
@Component({
  selector: 'app-mail-header',
  templateUrl: './mail-header.component.html',
  styleUrls: ['./mail-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MailHeaderComponent implements OnInit {
  @ViewChild('logoutModal') logoutModal: any;

  @ViewChild('advancedSearchModal') advancedSearchModal: any;

  @ViewChild('advancedSearchElement') advancedSearchElement: any;

  private advancedSearchModalRef: NgbModalRef;

  // Public property of boolean type set false by default
  menuIsOpened = false;

  selectedLanguage: Language = { name: 'English', locale: 'en' };

  // Language should be set at least once here
  // Because a user can use multiple account with different language
  isSetLanguage = false;

  languages = LANGUAGES;

  searchInput = new FormControl();

  searchPlaceholder = 'common.search';

  loadingImage = LOADING_IMAGE;

  private isContactsPage: boolean;

  primaryWebsite = PRIMARY_WEBSITE;

  isDarkMode: boolean;

  isForceLightMode: boolean;

  isElectron = false;

  constructor(
    private store: Store<AppState>,
    config: NgbDropdownConfig,
    private router: Router,
    private translate: TranslateService,
    private modalService: NgbModal,
    @Inject(DOCUMENT) private document: Document,
    private composeMailService: ComposeMailService,
    private httpCancelService: HttpCancelService,
    private themeToggleService: ThemeToggleService,
    private electronService: ElectronService,
  ) {
    config.autoClose = true;
  }

  ngOnInit() {
    /**
     * Change language with user's setting language
     */
    this.store
      .select(state => state.user)
      .pipe(untilDestroyed(this))
      .subscribe((user: UserState) => {
        this.isDarkMode = user.settings.is_night_mode;
        if (user.settings.language) {
          const language = this.languages.find(item => item.name === user.settings.language);
          if (this.selectedLanguage.name !== language.name || !this.isSetLanguage) {
            this.isSetLanguage = true;
            this.translate.use(language.locale);
          }
          this.selectedLanguage = language;
        }
      });

    this.setSearchPlaceholder(this.router.url);
    /**
     * Change placeholder of search bar on contacts page
     */
    this.router.events
      .pipe(
        untilDestroyed(this),
        filter(event => event instanceof NavigationEnd),
      )
      .subscribe((event: NavigationEnd) => {
        this.setSearchPlaceholder(event.url);
      });

    this.store
      .select(state => state.search)
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        this.searchInput.setValue('', { emitEvent: false, emitModelToViewChange: true, emitViewToModelChange: false });
      });

    this.isForceLightMode = this.themeToggleService.getIsForceLightMode();
    this.isElectron = this.electronService.isElectron;
  }

  setSearchPlaceholder(url: string) {
    this.isContactsPage = url === '/mail/contacts';
    this.searchPlaceholder = this.isContactsPage ? 'common.search_contacts' : 'common.search';
  }

  search() {
    if (this.searchInput.value) {
      if (this.isContactsPage) {
        this.router.navigate(['/mail/contacts'], { queryParams: { search: this.searchInput.value } });
      } else {
        this.router.navigate(['/mail/search/page', 1], { queryParams: { search: true, q: this.searchInput.value } });
      }
    }
  }

  // == Setup click event to toggle mobile menu
  toggleMenu() {
    // click handler
    const bool = this.menuIsOpened;
    this.menuIsOpened = bool === false;
    this.document.body.classList.add('menu-open');
  }

  logout() {
    this.httpCancelService.cancelPendingRequests();
    this.store.dispatch(new SaveDraftOnLogout());
    const modalReference = this.modalService.open(this.logoutModal, {
      centered: true,
      backdrop: 'static',
      windowClass: 'modal-md change-password-modal',
    });
    setTimeout(() => {
      this.store.dispatch(new ExpireSession());
      setTimeout(() => {
        this.store.dispatch(new Logout());
        modalReference.close();
      }, 500);
    }, 2500);
  }

  openComposeMailDialog(receivers: any) {
    this.composeMailService.openComposeMailDialog({ receivers });
  }

  openAdvancedSearchModal() {
    this.advancedSearchModalRef = this.modalService.open(this.advancedSearchModal, {
      backdrop: false,
      windowClass: 'modal-md advanced-search-modal',
    });
  }

  closeAdvancedSearch(query: any) {
    if (query) {
      this.searchInput.setValue(query);
    }
    this.advancedSearchElement?.close();
  }

  onLightDarkMode() {
    this.isForceLightMode = !this.isForceLightMode;
    if (this.isForceLightMode) {
      this.themeToggleService.forceLightModeTheme();
    } else {
      this.themeToggleService.forceDarkModeTheme();
    }
  }
}
