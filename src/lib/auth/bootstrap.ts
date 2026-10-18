/** Texts for the very first registration of a fresh install (the account becomes the platform owner). */

export function bootstrapNotice(needsCode: boolean): string {
  return needsCode
    ? 'Đây là lần cài đặt đầu tiên: tài khoản này sẽ là quản trị tối cao. Nhập mã khởi tạo mà người dựng máy chủ đã đặt (BOOTSTRAP_CODE).'
    : 'Đây là lần cài đặt đầu tiên: tài khoản này sẽ là quản trị tối cao của hệ thống.';
}

export function bootstrapErrorMessage(): string {
  return 'Mã khởi tạo không đúng. Xem BOOTSTRAP_CODE trong file .env trên máy chủ.';
}
