import {Component, EventEmitter, Output} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {TranslateModule} from "@ngx-translate/core";
import { PasswordModule } from 'primeng/password';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import {NgClass, NgIf} from "@angular/common";

@Component({
  selector: 'app-password-prompt',
  standalone: true,
  imports: [
    FormsModule,
    FontAwesomeModule,
    PasswordModule,
    TranslateModule,
    NgIf,
    NgClass
  ],
  templateUrl: './password-prompt.component.html',
  styleUrl: './password-prompt.component.scss'
})
export class PasswordPromptComponent {


  visible:boolean= false;
  showPassword: boolean = false;
  @Output() passwordSubmitted = new EventEmitter<string>();


  viewPassword(){
    this.visible = !this.visible
    this.showPassword =!this.showPassword;
  }

  submitPassword(passwordForm: any): void {
    if (passwordForm.valid) {
      this.passwordSubmitted.emit(passwordForm.value.password);
    }
  }
}
