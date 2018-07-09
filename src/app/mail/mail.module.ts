// == Angular modules
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

// Bootstrap
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { MailRoutingModule } from './mail-routing.module';

// component
import { MailComponent } from './mail.component';
import { MailFooterComponent } from './mail-footer/mail-footer.component';
import { MailHeaderComponent } from './mail-header/mail-header.component';
import { MailSettingsComponent } from './mail-settings/mail-settings.component';
import { MailSidebarComponent } from './mail-sidebar/mail-sidebar.component';
import { MailDetailComponent } from './mail-detail/mail-detail.component';
import { MailListComponent } from './mail-list/mail-list.component';
import { MailContactComponent } from './mail-contact/mail-contact.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Custom Pipe
import { SaveContactComponent } from './mail-contact/save-contact/save-contact.component';
import { ComposeMailComponent } from './mail-sidebar/compose-mail/compose-mail.component';
import { SharedModule } from '../shared/shared.module';
import { SaveListContactComponent } from './mail-settings/save-list-contact/save-list-contact.component';
import { MailTrashListComponent } from './mail-trash-list/mail-trash-list.component';

@NgModule({
  imports: [
    CommonModule,
    NgbModule,
    MailRoutingModule,
    FormsModule,
    SharedModule,
    ReactiveFormsModule
  ],
  declarations: [
    MailComponent,
    MailFooterComponent,
    MailHeaderComponent,
    MailSettingsComponent,
    MailSidebarComponent,
    MailDetailComponent,
    MailListComponent,
    MailContactComponent,
    SaveContactComponent,
    ComposeMailComponent,
    SaveListContactComponent,
    MailTrashListComponent
  ],
  exports: [MailFooterComponent]
})
export class MailModule { }
