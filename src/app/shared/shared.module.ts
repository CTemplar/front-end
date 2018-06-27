// Angular
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SpinnerComponent } from './spinner/components/spinner.component';
import { SpinnerService } from './spinner/services/spinner.service';
import { PricePlanComponent } from './price-plan/price-plan.component';
import { StorageDropdownComponent } from './price-plan/prime-plan/storage-dropdown/storage-dropdown.component';
import { PaymentSelectorComponent } from './price-plan/prime-plan/payment-selector/payment-selector.component';
import { CurrencyDropdownComponent } from './price-plan/currency-dropdown/currency-dropdown.component';
import { FreePlanComponent } from './price-plan/free-plan/free-plan.component';
import { PrimePlanComponent } from './price-plan/prime-plan/prime-plan.component';
import { SpinnerImageComponent } from './spinner-image/spinner-image.component';
import { LoadingComponent } from './loading/loading.component';
import { ngxZendeskWebwidgetModule } from 'ngx-zendesk-webwidget';
import { LoadingSpinnerComponent } from './loading-spinner/loading-spinner.component';
import { MatKeyboardModule } from './virtual-keyboard/keyboard.module';

@NgModule({
  imports: [CommonModule, MatKeyboardModule],
  declarations: [
    SpinnerComponent,
    PricePlanComponent,
    StorageDropdownComponent,
    PaymentSelectorComponent,
    CurrencyDropdownComponent,
    FreePlanComponent,
    PrimePlanComponent,
    SpinnerImageComponent,
    LoadingComponent,
    LoadingSpinnerComponent,
  ],
  exports: [
    SpinnerComponent,
    PricePlanComponent,
    LoadingComponent,
    SpinnerImageComponent,
    ngxZendeskWebwidgetModule,
    LoadingSpinnerComponent,
    MatKeyboardModule
  ],
  providers: [SpinnerService]
})
export class SharedModule {}
