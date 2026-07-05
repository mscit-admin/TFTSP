import { Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { AutoCompleteModule, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { PersonService } from '../../core/services/person.service';
import { TribalUnitService } from '../../core/services/tribal-unit.service';
import { ChangeRequestService } from '../../core/services/change-request.service';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { buildCreatePatch, buildUpdatePatch } from '../../core/util/person-patch';
import { PersonDocumentsComponent } from './person-documents.component';
import type {
  ApiErrorBody,
  ContributionType,
  CreatePersonDto,
  DuplicateCandidate,
  Gender,
  Person,
  TribalUnit,
  UpdatePersonDto,
} from '../../core/models';
import { DUPLICATE_MESSAGE_KEY, VERSION_CONFLICT_MESSAGE_KEY } from '../../core/models';

@Component({
  selector: 'app-person-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    InputTextModule,
    SelectModule,
    TextareaModule,
    AutoCompleteModule,
    CheckboxModule,
    ButtonModule,
    DialogModule,
    MessageModule,
    PersonDocumentsComponent,
  ],
  template: `
    <div class="mx-auto max-w-3xl">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-xl font-semibold text-gray-800">
          {{ (isEdit() ? 'persons.editTitle' : 'persons.newTitle') | translate }}
        </h1>
        <p-button
          icon="pi pi-arrow-left"
          [text]="true"
          severity="secondary"
          [ariaLabel]="'actions.back' | translate"
          (onClick)="back()"
        />
      </div>

      @if (!canWrite()) {
        <p-message severity="info" [text]="'persons.proposalNotice' | translate" styleClass="mb-4" />
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <!-- Name parts -->
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'persons.fields.firstName' | translate }} *</span>
          <input pInputText formControlName="firstName" class="w-full" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'persons.fields.fatherName' | translate }}</span>
          <input pInputText formControlName="fatherName" class="w-full" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{
            'persons.fields.grandfatherName' | translate
          }}</span>
          <input pInputText formControlName="grandfatherName" class="w-full" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'persons.fields.familyName' | translate }}</span>
          <input pInputText formControlName="familyName" class="w-full" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'persons.fields.laqab' | translate }}</span>
          <input pInputText formControlName="laqab" class="w-full" />
        </label>

        <!-- Gender -->
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'persons.fields.gender' | translate }} *</span>
          <p-select
            formControlName="gender"
            [options]="genderOptions"
            optionLabel="label"
            optionValue="value"
            styleClass="w-full"
          />
        </label>

        <!-- Birth -->
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'persons.fields.birthDate' | translate }}</span>
          <input
            pInputText
            formControlName="birthDate"
            [attr.dir]="'ltr'"
            placeholder="YYYY-MM-DD / YYYY"
            class="w-full"
          />
          <small class="text-gray-400">{{ 'persons.hints.partialDate' | translate }}</small>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'persons.fields.birthPlace' | translate }}</span>
          <input pInputText formControlName="birthPlace" class="w-full" />
        </label>

        <!-- Deceased -->
        <div class="flex items-center gap-2 md:col-span-2">
          <p-checkbox formControlName="isDeceased" [binary]="true" inputId="isDeceased" />
          <label for="isDeceased" class="text-sm text-gray-700">{{
            'persons.fields.isDeceased' | translate
          }}</label>
        </div>

        @if (form.controls.isDeceased.value) {
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700">{{ 'persons.fields.deathDate' | translate }}</span>
            <input
              pInputText
              formControlName="deathDate"
              [attr.dir]="'ltr'"
              placeholder="YYYY-MM-DD / YYYY"
              class="w-full"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700">{{ 'persons.fields.deathPlace' | translate }}</span>
            <input pInputText formControlName="deathPlace" class="w-full" />
          </label>
        }

        <!-- Father picker (male) -->
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'persons.fields.father' | translate }}</span>
          <p-autocomplete
            formControlName="father"
            [suggestions]="fatherSuggestions()"
            (completeMethod)="searchParent($event, 'male')"
            optionLabel="fullName"
            [forceSelection]="true"
            [dropdown]="true"
            styleClass="w-full"
            appendTo="body"
          />
        </label>
        <!-- Mother picker (female) -->
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'persons.fields.mother' | translate }}</span>
          <p-autocomplete
            formControlName="mother"
            [suggestions]="motherSuggestions()"
            (completeMethod)="searchParent($event, 'female')"
            optionLabel="fullName"
            [forceSelection]="true"
            [dropdown]="true"
            styleClass="w-full"
            appendTo="body"
          />
        </label>

        <!-- Tribal unit -->
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'persons.fields.tribalUnit' | translate }}</span>
          <p-select
            formControlName="tribalUnitId"
            [options]="unitOptions()"
            optionLabel="label"
            optionValue="value"
            [showClear]="true"
            [filter]="true"
            styleClass="w-full"
            appendTo="body"
          />
        </label>

        <!-- Profession -->
        <label class="flex flex-col gap-1">
          <span class="text-sm text-gray-700">{{ 'persons.fields.profession' | translate }}</span>
          <input pInputText formControlName="profession" class="w-full" />
        </label>

        <!-- Biography / story (sanitized server-side) -->
        <label class="flex flex-col gap-1 md:col-span-2">
          <span class="text-sm text-gray-700">{{ 'persons.fields.biography' | translate }}</span>
          <textarea pTextarea formControlName="biography" rows="4" class="w-full"></textarea>
          <small class="text-gray-400">{{ 'persons.hints.biography' | translate }}</small>
        </label>

        <!-- Contribution type (non-admin proposal path) -->
        @if (!canWrite()) {
          <label class="flex flex-col gap-1 md:col-span-2">
            <span class="text-sm text-gray-700">{{ 'contributions.type' | translate }}</span>
            <p-select
              [(ngModel)]="contributionType"
              [ngModelOptions]="{ standalone: true }"
              [options]="contributionOptions()"
              optionValue="value"
              styleClass="w-full sm:w-80"
            >
              <ng-template let-o pTemplate="selectedItem">{{ o.labelKey | translate }}</ng-template>
              <ng-template let-o pTemplate="item">{{ o.labelKey | translate }}</ng-template>
            </p-select>
          </label>
        }

        @if (errorKey()) {
          <div class="md:col-span-2">
            <p-message severity="error" [text]="errorKey()! | translate" />
          </div>
        }

        <div class="mt-2 flex gap-2 md:col-span-2">
          <p-button
            type="submit"
            [label]="submitLabelKey() | translate"
            [loading]="saving()"
            [disabled]="form.invalid || saving()"
          />
          <p-button
            type="button"
            [label]="'actions.cancel' | translate"
            severity="secondary"
            [text]="true"
            (onClick)="back()"
          />
        </div>
      </form>

      <!-- Documents (M4) — admins manage documents on an existing person directly. -->
      @if (isEdit() && canWrite() && id(); as pid) {
        <div class="mt-6">
          <app-person-documents [personId]="pid" />
        </div>
      }
    </div>

    <!-- Duplicate-candidate confirmation (Spec Section 8) -->
    <p-dialog
      [visible]="showDuplicates()"
      (visibleChange)="onDuplicateDialogVisible($event)"
      [modal]="true"
      [header]="'persons.duplicates.title' | translate"
      [style]="{ width: '32rem' }"
    >
      <p class="mb-3 text-sm text-gray-600">{{ 'persons.duplicates.body' | translate }}</p>
      <ul class="mb-4 flex flex-col gap-2">
        @for (c of duplicates(); track c.person.id) {
          <li class="rounded-md border border-gray-200 p-2 text-sm">
            <span class="font-medium">{{ c.person.fullName }}</span>
            @if (c.person.fatherName) {
              <span class="text-gray-500"> — {{ c.person.fatherName }}</span>
            }
            <span class="text-gray-400">
              ({{ 'persons.duplicates.similarity' | translate }}:
              {{ (c.similarity * 100).toFixed(0) }}%)</span
            >
          </li>
        }
      </ul>
      <div class="flex justify-end gap-2">
        <p-button
          [label]="'actions.cancel' | translate"
          severity="secondary"
          [text]="true"
          (onClick)="showDuplicates.set(false)"
        />
        <p-button
          [label]="'persons.duplicates.confirmCreate' | translate"
          severity="warn"
          [loading]="saving()"
          (onClick)="confirmDuplicateCreate()"
        />
      </div>
    </p-dialog>
  `,
})
export class PersonFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly personService = inject(PersonService);
  private readonly unitService = inject(TribalUnitService);
  private readonly changeRequests = inject(ChangeRequestService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);
  private readonly lang = inject(LanguageService);

  /** Route param (bound via withComponentInputBinding). Absent on /persons/new. */
  readonly id = input<string>();

  readonly canWrite = this.auth.canWrite;
  readonly isEdit = computed(() => !!this.id());
  /** Non-admins submit a Change Request instead of a direct write (M2). */
  readonly submitLabelKey = computed(() =>
    this.canWrite() ? 'actions.save' : 'changeRequests.submitForReview',
  );

  readonly saving = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly fatherSuggestions = signal<Person[]>([]);
  readonly motherSuggestions = signal<Person[]>([]);
  readonly units = signal<TribalUnit[]>([]);
  readonly showDuplicates = signal(false);
  readonly duplicates = signal<DuplicateCandidate[]>([]);

  private version = 0;
  /** Original entity kept for computing an update JSON Patch on the non-admin path. */
  private original: Person | null = null;

  /** Selected contribution type for the non-admin proposal path (M4 §13). */
  contributionType: ContributionType = 'add_person';

  /** Contribution options depend on create vs edit (Spec §13). */
  readonly contributionOptions = computed(() => {
    const opts: ContributionType[] = this.isEdit()
      ? ['edit_data', 'fix_relation', 'add_biography', 'add_source']
      : ['add_person'];
    return opts.map((t) => ({ value: t, labelKey: `contributions.types.${t}` }));
  });

  readonly genderOptions = [
    { label: this.i18n.instant('persons.genderValue.male'), value: 'male' as Gender },
    { label: this.i18n.instant('persons.genderValue.female'), value: 'female' as Gender },
  ];

  readonly unitOptions = computed(() =>
    this.units().map((u) => ({
      value: u.id,
      label: `${this.lang.isRtl() ? u.nameAr : u.nameEn} · ${this.i18n.instant(
        'tribalUnits.type.' + u.unitType,
      )}`,
    })),
  );

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    fatherName: [''],
    grandfatherName: [''],
    familyName: [''],
    laqab: [''],
    gender: ['male' as Gender, [Validators.required]],
    birthDate: [''],
    birthPlace: [''],
    isDeceased: [false],
    deathDate: [''],
    deathPlace: [''],
    father: this.fb.control<Person | null>(null),
    mother: this.fb.control<Person | null>(null),
    tribalUnitId: this.fb.control<string | null>(null),
    profession: [''],
    biography: [''],
  });

  constructor() {
    this.unitService.list().subscribe({
      next: (list) => this.units.set(list),
      error: () => this.units.set([]),
    });
    // Load the person after inputs are bound (microtask keeps id() populated).
    queueMicrotask(() => {
      const id = this.id();
      if (id) {
        this.contributionType = 'edit_data';
        this.loadPerson(id);
      }
    });
  }

  private loadPerson(id: string): void {
    this.personService.get(id).subscribe({
      next: (p) => {
        this.version = p.version;
        this.original = p;
        this.form.patchValue({
          firstName: p.firstName,
          fatherName: p.fatherName ?? '',
          grandfatherName: p.grandfatherName ?? '',
          familyName: p.familyName ?? '',
          laqab: p.laqab ?? '',
          gender: p.gender ?? 'male',
          birthDate: p.birthDate ?? '',
          birthPlace: p.birthPlace ?? '',
          isDeceased: p.isDeceased ?? false,
          deathDate: p.deathDate ?? '',
          deathPlace: p.deathPlace ?? '',
          tribalUnitId: p.tribalUnitId ?? null,
          profession: p.profession ?? '',
          biography: p.biography ?? '',
        });
        // Resolve parent display objects lazily.
        if (p.fatherId) this.hydrateParent(p.fatherId, 'father');
        if (p.motherId) this.hydrateParent(p.motherId, 'mother');
      },
      error: () => this.errorKey.set('errors.generic'),
    });
  }

  private hydrateParent(id: string, which: 'father' | 'mother'): void {
    this.personService.get(id).subscribe({
      next: (p) => this.form.controls[which].setValue(p),
      error: () => void 0,
    });
  }

  searchParent(event: AutoCompleteCompleteEvent, gender: Gender): void {
    this.personService.list({ q: event.query, pageSize: 10 }).subscribe({
      next: (res) => {
        // Contract assumption: /persons has no gender filter in M1 → filter client-side.
        const filtered = res.data.filter((p) => p.gender === gender);
        (gender === 'male' ? this.fatherSuggestions : this.motherSuggestions).set(filtered);
      },
      error: () => void 0,
    });
  }

  private buildDto(confirmDuplicate = false): CreatePersonDto {
    const v = this.form.getRawValue();
    return {
      firstName: v.firstName,
      fatherName: v.fatherName || undefined,
      grandfatherName: v.grandfatherName || undefined,
      familyName: v.familyName || undefined,
      laqab: v.laqab || undefined,
      gender: v.gender,
      birthDate: v.birthDate || undefined,
      birthPlace: v.birthPlace || undefined,
      isDeceased: v.isDeceased,
      deathDate: v.isDeceased ? v.deathDate || undefined : undefined,
      deathPlace: v.isDeceased ? v.deathPlace || undefined : undefined,
      fatherId: v.father?.id,
      motherId: v.mother?.id,
      tribalUnitId: v.tribalUnitId || undefined,
      profession: v.profession || undefined,
      biography: v.biography || undefined,
      confirmDuplicate: confirmDuplicate || undefined,
    };
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorKey.set(null);
    const id = this.id();
    // Non-admin roles route the write through the approval workflow (M2).
    if (!this.canWrite()) {
      this.submitAsChangeRequest(id);
      return;
    }
    if (id) {
      this.doUpdate(id);
    } else {
      this.doCreate(false);
    }
  }

  /** Build a JSON-Patch change request and submit it for review (non-admin path). */
  private submitAsChangeRequest(id?: string): void {
    const dto = this.buildDto();
    const patch = id
      ? buildUpdatePatch(this.original ?? ({} as Person), dto)
      : buildCreatePatch(dto);

    if (id && patch.length === 0) {
      this.errorKey.set('changeRequests.noChanges');
      return;
    }

    this.saving.set(true);
    this.changeRequests
      .create({
        targetType: 'person',
        targetId: id,
        operation: id ? 'update' : 'create',
        patch,
        contributionType: this.contributionType,
      })
      .subscribe({
        next: (cr) => {
          // Created as draft → submit into the review queue.
          this.changeRequests.submit(cr.id).subscribe({
            next: () => {
              this.saving.set(false);
              this.messages.add({
                severity: 'success',
                detail: this.i18n.instant('changeRequests.submittedToast'),
              });
              this.router.navigate(['/my-requests']);
            },
            error: (err: HttpErrorResponse) => this.onChangeRequestError(err),
          });
        },
        error: (err: HttpErrorResponse) => this.onChangeRequestError(err),
      });
  }

  private onChangeRequestError(err: HttpErrorResponse): void {
    this.saving.set(false);
    const body = err.error as ApiErrorBody | undefined;
    this.errorKey.set(body?.messageKey ?? 'errors.generic');
  }

  private doCreate(confirmDuplicate: boolean): void {
    this.saving.set(true);
    this.personService.create(this.buildDto(confirmDuplicate)).subscribe({
      next: () => this.onSaved(),
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const body = err.error as ApiErrorBody | undefined;
        if (err.status === 409 && body?.messageKey === DUPLICATE_MESSAGE_KEY) {
          const candidates = (body.details?.['candidates'] as DuplicateCandidate[]) ?? [];
          this.duplicates.set(candidates);
          this.showDuplicates.set(true);
          return;
        }
        this.errorKey.set(body?.messageKey ?? 'errors.generic');
      },
    });
  }

  confirmDuplicateCreate(): void {
    this.showDuplicates.set(false);
    this.doCreate(true);
  }

  onDuplicateDialogVisible(visible: boolean): void {
    this.showDuplicates.set(visible);
  }

  private doUpdate(id: string): void {
    this.saving.set(true);
    const dto: UpdatePersonDto = { ...this.buildDto(), version: this.version };
    this.personService.update(id, dto).subscribe({
      next: () => this.onSaved(),
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const body = err.error as ApiErrorBody | undefined;
        if (err.status === 409 && body?.messageKey === VERSION_CONFLICT_MESSAGE_KEY) {
          this.errorKey.set('persons.versionConflict');
          return;
        }
        this.errorKey.set(body?.messageKey ?? 'errors.generic');
      },
    });
  }

  private onSaved(): void {
    this.saving.set(false);
    this.messages.add({ severity: 'success', detail: this.i18n.instant('persons.saved') });
    this.router.navigate(['/persons']);
  }

  back(): void {
    this.router.navigate(['/persons']);
  }
}
