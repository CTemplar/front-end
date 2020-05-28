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

  subjectChanged() {
    let val = document.getElementById('sub').children[1].value
    let _test = document.getElementById('test');
   _test.innerHTML = val
   setTimeout(() => {
   let MailDivWidth = document.getElementById('myMailSubject').offsetWidth
   if(this.isFullScreen==false){
       this.myMailWidth = MailDivWidth
   }
   if(_test.offsetWidth < this.myMailWidth-20 ){
    document.getElementById('myMailSubject').classList.remove('mail-composer-title-fullscreen')
    this.mailSubject = val;
    this.myMail = val + '...';
   }
   if( _test.offsetWidth  > this.myMailWidth-30 ){
    document.getElementById('myMailSubject').classList.remove('mail-composer-title-fullscreen')
    this.mailSubject = this.myMail;
   }
   if(_test.offsetWidth < MailDivWidth-40 && this.isFullScreen==true){
    document.getElementById('myMailSubject').classList.add('mail-composer-title-fullscreen')
    this.mailSubject = val;
    this.myFullMail = val + '...';
   }
   if( _test.offsetWidth  > MailDivWidth-30 && this.isFullScreen==true){
    document.getElementById('myMailSubject').classList.add('mail-composer-title-fullscreen')
    this.mailSubject = this.myFullMail;
   }
   if(_test.offsetWidth<120){
     this.myMinMail = val + '...';
     this.mailMinimized = this.myMinMail;
   }
   if( _test.offsetWidth>MailDivWidth-100){
    this.mailMinimized = this.myMinMail;
    return
   }
  });
   
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
    this.subjectChanged()
  }

  toggleFullScreen() {
    this.isFullScreen = !this.isFullScreen;
    this.fullScreen.emit(this.isFullScreen);
    if (this.isMinimized) {
      this.isMinimized = false;
    }
    this.subjectChanged()
  }

  private hideMailComposeDialog() {
    if (this.confirmModalRef) {
      this.confirmModalRef.dismiss();
    }
    this.hide.emit(true);
  }

}
