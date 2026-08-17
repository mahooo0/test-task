import { HttpStatus } from '@nestjs/common';
import type { ApiErrorCode } from '@dataroom/types';
import { DEFAULT_API_LOCALE, type ApiLocale } from './locale';

interface MessageEntry {
  /** The HTTP status this message is returned with — so `AppException` needs only the key. */
  status: HttpStatus;
  en: string;
  ru: string;
  uk: string;
}

/**
 * The single source of truth for user-facing API messages: one entry per stable key, each carrying
 * its HTTP status and the three shipped locales. Dynamic bits are ICU-style `{placeholders}` filled
 * in by {@link translate}. Services throw an `AppException(key, …)` and never hard-code a language —
 * the exception filter resolves the text per request locale here.
 */
export const MESSAGES = {
  // ── items ──────────────────────────────────────────────────────────────────
  'items.notFound': {
    status: HttpStatus.NOT_FOUND,
    en: 'Item not found',
    ru: 'Элемент не найден',
    uk: 'Елемент не знайдено',
  },
  'items.folderNotFound': {
    status: HttpStatus.NOT_FOUND,
    en: 'Folder not found',
    ru: 'Папка не найдена',
    uk: 'Папку не знайдено',
  },
  'items.moveIntoSelf': {
    status: HttpStatus.BAD_REQUEST,
    en: 'You can’t move a folder into itself or one of its subfolders',
    ru: 'Нельзя переместить папку в саму себя или в свою вложенную папку',
    uk: 'Не можна перемістити папку в саму себе або в її вкладену папку',
  },
  'items.nameConflict': {
    status: HttpStatus.CONFLICT,
    en: 'An item with that name already exists here',
    ru: 'Элемент с таким именем уже существует здесь',
    uk: 'Елемент із такою назвою вже існує тут',
  },
  'items.onlyFilesDownloadable': {
    status: HttpStatus.BAD_REQUEST,
    en: 'Only files can be downloaded',
    ru: 'Скачивать можно только файлы',
    uk: 'Завантажувати можна лише файли',
  },
  'items.folderNameExhausted': {
    status: HttpStatus.CONFLICT,
    en: 'Couldn’t find a free folder name — please try again',
    ru: 'Не удалось подобрать свободное имя папки — попробуйте ещё раз',
    uk: 'Не вдалося дібрати вільну назву папки — спробуйте ще раз',
  },

  // ── room ───────────────────────────────────────────────────────────────────
  'room.notFound': {
    status: HttpStatus.NOT_FOUND,
    en: 'Data room not found',
    ru: 'Хранилище данных не найдено',
    uk: 'Сховище даних не знайдено',
  },

  // ── trash ──────────────────────────────────────────────────────────────────
  'trash.notFound': {
    status: HttpStatus.NOT_FOUND,
    en: 'Item not found in the Trash',
    ru: 'Элемент не найден в корзине',
    uk: 'Елемент не знайдено в кошику',
  },

  // ── shares ─────────────────────────────────────────────────────────────────
  'share.notFound': {
    status: HttpStatus.NOT_FOUND,
    en: 'Share not found',
    ru: 'Общий доступ не найден',
    uk: 'Спільний доступ не знайдено',
  },
  'share.resourceNotFound': {
    status: HttpStatus.NOT_FOUND,
    en: 'The shared resource no longer exists',
    ru: 'Ресурс с общим доступом больше не существует',
    uk: 'Ресурс зі спільним доступом більше не існує',
  },
  'share.onlyRestrictedInvitees': {
    status: HttpStatus.BAD_REQUEST,
    en: 'Invitees can be added only to a restricted share',
    ru: 'Приглашать можно только при ограниченном доступе',
    uk: 'Запрошувати можна лише за обмеженого доступу',
  },
  'share.revoked': {
    status: HttpStatus.BAD_REQUEST,
    en: 'This share has been revoked',
    ru: 'Этот общий доступ был отозван',
    uk: 'Цей спільний доступ було відкликано',
  },
  'share.resourceIdRequired': {
    status: HttpStatus.BAD_REQUEST,
    en: 'Choose an item to share',
    ru: 'Выберите элемент, к которому открыть доступ',
    uk: 'Виберіть елемент, до якого відкрити доступ',
  },

  // ── pagination cursor ──────────────────────────────────────────────────────
  'cursor.mismatchedSort': {
    status: HttpStatus.BAD_REQUEST,
    en: 'The page cursor doesn’t match the current sort order',
    ru: 'Курсор страницы не соответствует выбранному порядку сортировки',
    uk: 'Курсор сторінки не відповідає вибраному порядку сортування',
  },
  'cursor.invalid': {
    status: HttpStatus.BAD_REQUEST,
    en: 'Invalid page cursor',
    ru: 'Недействительный курсор страницы',
    uk: 'Недійсний курсор сторінки',
  },

  // ── uploads ────────────────────────────────────────────────────────────────
  'upload.storageUnavailable': {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    en: 'Uploads are temporarily unavailable',
    ru: 'Загрузка временно недоступна',
    uk: 'Завантаження тимчасово недоступне',
  },
  'upload.onlyPdf': {
    status: HttpStatus.BAD_REQUEST,
    en: 'Only PDF files can be uploaded',
    ru: 'Можно загружать только PDF',
    uk: 'Можна завантажувати лише PDF',
  },
  'upload.tooLarge': {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    en: 'File exceeds the {maxMb} MB upload limit',
    ru: 'Файл превышает лимит {maxMb} МБ',
    uk: 'Файл перевищує ліміт {maxMb} МБ',
  },
  'upload.fileNameExhausted': {
    status: HttpStatus.CONFLICT,
    en: 'Couldn’t find a free file name — please try again',
    ru: 'Не удалось подобрать свободное имя файла — попробуйте ещё раз',
    uk: 'Не вдалося дібрати вільну назву файлу — спробуйте ще раз',
  },
  'upload.pendingNotFound': {
    status: HttpStatus.NOT_FOUND,
    en: 'Pending upload not found',
    ru: 'Ожидающая загрузка не найдена',
    uk: 'Очікуване завантаження не знайдено',
  },
  'upload.notReceived': {
    status: HttpStatus.BAD_REQUEST,
    en: 'The file didn’t reach storage — it wasn’t received',
    ru: 'Файл не дошёл до хранилища — он не был получен',
    uk: 'Файл не дійшов до сховища — його не отримано',
  },
  'upload.finalizeNameExhausted': {
    status: HttpStatus.CONFLICT,
    en: 'Couldn’t finalize the upload name — please try again',
    ru: 'Не удалось завершить загрузку из-за имени — попробуйте ещё раз',
    uk: 'Не вдалося завершити завантаження через назву — спробуйте ще раз',
  },

  // ── auth ───────────────────────────────────────────────────────────────────
  'auth.missingToken': {
    status: HttpStatus.UNAUTHORIZED,
    en: 'Missing authentication token',
    ru: 'Отсутствует токен аутентификации',
    uk: 'Відсутній токен автентифікації',
  },
  'auth.invalidSession': {
    status: HttpStatus.UNAUTHORIZED,
    en: 'Invalid or expired session',
    ru: 'Недействительная или истёкшая сессия',
    uk: 'Недійсна або застаріла сесія',
  },
  'auth.userGone': {
    status: HttpStatus.UNAUTHORIZED,
    en: 'This account no longer exists',
    ru: 'Этот аккаунт больше не существует',
    uk: 'Цей обліковий запис більше не існує',
  },

  // ── generic fallbacks (framework / validation errors not thrown as AppException) ──
  'generic.validation': {
    status: HttpStatus.BAD_REQUEST,
    en: 'Please check the information you entered',
    ru: 'Проверьте введённые данные',
    uk: 'Перевірте введені дані',
  },
  'generic.unauthenticated': {
    status: HttpStatus.UNAUTHORIZED,
    en: 'Please sign in to continue',
    ru: 'Войдите, чтобы продолжить',
    uk: 'Увійдіть, щоб продовжити',
  },
  'generic.forbidden': {
    status: HttpStatus.FORBIDDEN,
    en: 'You don’t have access to this',
    ru: 'У вас нет доступа к этому',
    uk: 'У вас немає доступу до цього',
  },
  'generic.notFound': {
    status: HttpStatus.NOT_FOUND,
    en: 'Not found',
    ru: 'Не найдено',
    uk: 'Не знайдено',
  },
  'generic.conflict': {
    status: HttpStatus.CONFLICT,
    en: 'This already exists',
    ru: 'Такой элемент уже существует',
    uk: 'Такий елемент уже існує',
  },
  'generic.payloadTooLarge': {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    en: 'The request is too large',
    ru: 'Слишком большой запрос',
    uk: 'Занадто великий запит',
  },
  'generic.internal': {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    en: 'Something went wrong on our side',
    ru: 'Что-то пошло не так на нашей стороне',
    uk: 'Щось пішло не так з нашого боку',
  },
} satisfies Record<string, MessageEntry>;

export type MessageKey = keyof typeof MESSAGES;

/** Generic message per coarse error code — the fallback for errors not raised as an `AppException`. */
export const GENERIC_BY_CODE: Record<ApiErrorCode, MessageKey> = {
  VALIDATION: 'generic.validation',
  UNAUTHENTICATED: 'generic.unauthenticated',
  FORBIDDEN: 'generic.forbidden',
  NOT_FOUND: 'generic.notFound',
  CONFLICT: 'generic.conflict',
  PAYLOAD_TOO_LARGE: 'generic.payloadTooLarge',
  INTERNAL: 'generic.internal',
};

export type MessageParams = Record<string, string | number>;

/**
 * Resolve a message key to a localized string, filling ICU `{placeholders}` from `params`.
 * Falls back to the default locale, then English, then the raw key (should never happen).
 */
export function translate(
  key: MessageKey,
  locale: ApiLocale,
  params?: MessageParams,
): string {
  const entry = MESSAGES[key];
  const template = entry[locale] ?? entry[DEFAULT_API_LOCALE] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    params && name in params ? String(params[name]) : `{${name}}`,
  );
}
