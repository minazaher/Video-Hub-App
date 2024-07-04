import {Component, EventEmitter, Output} from '@angular/core';
import {FormsModule} from "@angular/forms";

@Component({
  selector: 'app-password-prompt',
  standalone: true,
  imports: [
    FormsModule
  ],
  templateUrl: './password-prompt.component.html',
  styleUrl: './password-prompt.component.scss'
})
export class PasswordPromptComponent {
  @Output() passwordSubmitted = new EventEmitter<string>();

  submitPassword(passwordForm: any): void {
    if (passwordForm.valid) {
      this.passwordSubmitted.emit(passwordForm.value.password);
    }
  }
}
