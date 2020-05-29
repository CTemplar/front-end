import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { Mail } from '../../../store/models';
import { ComposeMailComponent } from '../compose-mail/compose-mail.component';
import { KeyboardShortcutsComponent, ShortcutInput } from 'ng-keyboard-shortcuts';
import { getComposeMailDialogShortcuts } from '../../../store/services';
import { AppState, MailAction } from '../../../store/datatypes';
import { Store } from '@ngrx/store';
import { SetIsComposerPopUp } from '../../../store/actions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'app-compose-mail-dialog',
  templateUrl: './compose-mail-dialog.component.html',
  styleUrls: ['./compose-mail-dialog.component.scss', './../mail-sidebar.component.scss']
})
export class ComposeMailDialogComponent implements OnInit, AfterViewInit {
  @Input() public isComposeVisible: boolean;
  @Input() public draft: Mail;
  @Input() action: MailAction;
  @Input() parentId: number;

  @Input() public isFullScreen: boolean;

  @Output() public hide = new EventEmitter<boolean>();
  @Output() public minimize = new EventEmitter<boolean>();
  @Output() public fullScreen = new EventEmitter<boolean>();

  @ViewChild(ComposeMailComponent) composeMail: ComposeMailComponent;
  shortcuts: ShortcutInput[] = [];
  @ViewChild('input') input: ElementRef;
  @ViewChild(KeyboardShortcutsComponent) private keyboard: KeyboardShortcutsComponent;


  isMinimized: boolean;
  private confirmModalRef: NgbModalRef;
  mailSubject = '';
  mailMinimized = '';
  myMail = '';
  myMailWidth = 0;
  myFullMail = '';
  myMinMail = '';
  isPopupClosed: boolean;
  constructor(private modalService: NgbModal,
    private cdr: ChangeDetectorRef,
    private store: Store<AppState>) {
  }

  ngOnInit(): void {
    if (this.draft) {
      this.mailSubject = this.draft.subject;
    }
    this.store.select(state => state).pipe(untilDestroyed(this))
      .subscribe((appState: AppState) => {
        this.isPopupClosed = appState.mail.isComposerPopUp;
        if (this.isPopupClosed !== undefined && !this.isPopupClosed && this.action === MailAction.REPLY && this.composeMail !== undefined) {
          this.onHide();
        }
      });
  }

  ngAfterViewInit(): void {
    this.shortcuts = getComposeMailDialogShortcuts(this);

    if (this.mailSubject && this.action) {
      if (this.action === MailAction.REPLY) {
        this.mailSubject = 'Reply: ' + this.mailSubject;
      }
    }
    this.cdr.detectChanges();

  }

  onClose() {
    if (this.action === MailAction.REPLY) {
      setTimeout(res => {
        this.store.dispatch(new SetIsComposerPopUp(
          false
        ));
      }, 2000);
    }
    if (this.composeMail.hasData()) {
      this.saveInDrafts();
    } else if (this.composeMail.draftMail) {
      this.discardEmail();
    }
  }

  truncateMailTitle() {
    let subValue = document.getElementById('sub').children[1].value;
    let mailTitleTextWidth  = document.getElementById('mailTitleTextWidth');
    mailTitleTextWidth .innerHTML = subValue;
    setTimeout(() => {
      let MailDivWidth = document.getElementById('myMailSubject').offsetWidth
      if (this.isFullScreen == false) {
        this.myMailWidth = MailDivWidth;
      }

      if (mailTitleTextWidth .offsetWidth < this.myMailWidth - 20) {
        document.getElementById('myMailSubject').classList.remove('mail-composer-title-fullscreen')
        this.mailSubject = subValue;
        this.myMail = subValue + '...';
      }

      if (mailTitleTextWidth .offsetWidth > this.myMailWidth - 30) {
        document.getElementById('myMailSubject').classList.remove('mail-composer-title-fullscreen')
        this.mailSubject = this.myMail;
      }

      if (mailTitleTextWidth .offsetWidth < MailDivWidth - 40 && this.isFullScreen == true) {
        document.getElementById('myMailSubject').classList.add('mail-composer-title-fullscreen')
        this.mailSubject = subValue;
        this.myFullMail = subValue + '...';
      }

      if (mailTitleTextWidth .offsetWidth > MailDivWidth - 50 && this.isFullScreen == true) {
        document.getElementById('myMailSubject').classList.add('mail-composer-title-fullscreen')
        this.mailSubject = this.myFullMail;
      }
      
      if (mailTitleTextWidth .offsetWidth < 140) {
        this.myMinMail = subValue + '...';
        this.mailMinimized = this.myMinMail;
      }
      
      if (mailTitleTextWidth .offsetWidth > MailDivWidth - 100) {
        this.mailMinimized = this.myMinMail;
      }

    });
  }
  
  subjectChanged() {

    this.truncateMailTitle()
  }

  saveInDrafts() {
    this.composeMail.saveInDrafts();
  }

  discardEmail() {
    this.composeMail.discardEmail();
  }

  onHide() {
    this.store.dispatch(new SetIsComposerPopUp(
      false
    ));
    this.hideMailComposeDialog();
  }

  toggleMinimized() {
    this.isMinimized = !this.isMinimized;
    this.minimize.emit(this.isMinimized);
    if (this.isFullScreen) {
      this.isFullScreen = false;
    }
  }

  toggleFullScreen() {
    this.isFullScreen = !this.isFullScreen;
    this.fullScreen.emit(this.isFullScreen);
    if (this.isMinimized) {
      this.isMinimized = false;
    }
    this.myMailWidth = document.getElementById('myMailSubject').offsetWidth
    this.truncateMailTitle()
  }

  private hideMailComposeDialog() {
    if (this.confirmModalRef) {
      this.confirmModalRef.dismiss();
    }
    this.hide.emit(true);
  }

}
