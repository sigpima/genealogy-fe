/** Article bodies for the editor's round-trip tests. */

/** Hand-written bodies covering every construct and the awkward corners. */
export const SAMPLE_BODIES: Record<string, string> = {
  headings: '# Một\n\n## Hai\n\n### Ba\n\n#### Bốn',
  paragraphs: 'Đoạn một\ncó hai dòng.\n\nĐoạn hai.',
  emphasis: 'Chữ **đậm**, _nghiêng_, __đậm gạch__, *nghiêng sao*, và **đậm với _nghiêng_ trong**.',
  link: 'Xem [gia phả họ Nguyễn](https://example.com/gia-pha) và [thư](mailto:a@b.c), [trang](/su-ky/abc).',
  linkWithBold: 'Một [**liên kết đậm**](https://a.example) và [_nghiêng_](https://b.example).',
  image: 'Ảnh: ![Ông Tổ](media:12) trong đoạn.\n\n![](media:3)',
  lists: '- một\n- hai\n- ba\n\n1. x\n2. y\n3. z\n\n* sao\n+ cộng',
  adjacentLists: '- a\n- b\n\n- c\n\n1. d\n\n1. e',
  nestedLooking: '- cha\n  - con\n    - cháu',
  quote: '> Lời dạy của tổ tiên\n> nối dòng\n\nSau trích dẫn.',
  rule: 'Trên\n\n---\n\nDưới\n\n***\n\n___',
  literals: '2\\*3\\*4 và snake\\_case \\[x\\] \\# chữ \\\\ gạch chéo',
  specialsUnescaped: 'a * b * c, 5 * 6, snake_case_name, [không phải link], # giữa dòng, 1. giữa dòng, - giữa dòng',
  code: 'Chạy `npm test` và `a*b*c`.',
  empty: '',
  onlySpaces: '   \n\n  ',
  vietnamese: 'Khởi tổ: Nguyễn Văn A (1850 – 1920), sinh tại làng Tiên Điền, huyện Nghi Xuân. Đời thứ 2 có 3 chi: **Trưởng**, _Thứ_, Út.',
};

/** Long bodies shaped like a family chronicle (the owner's database holds no article yet, so these are written to look like theirs). */
export const LONG_BODIES: Record<string, string> = {
  'nguon-goc': `# Nguồn gốc dòng họ

Dòng họ **Nguyễn** ở làng Tiên Điền có từ cuối thế kỷ XVII. Theo lời kể của các cụ, *cụ Khởi tổ* từ miền Bắc vào lập nghiệp, khai khẩn đất bãi ven sông.

## Các đời đầu

1. Đời thứ nhất: cụ Nguyễn Văn A (1680 – 1752), lập nhà thờ họ.
2. Đời thứ hai: ba người con trai, chia thành ba chi **Trưởng**, **Thứ** và **Út**.
3. Đời thứ ba: bắt đầu có gia phả ghi chép.

> "Uống nước nhớ nguồn" - lời dạy của tổ tiên, treo ở gian giữa nhà thờ.

---

## Việc giỗ tổ

Giỗ tổ vào ngày 15 tháng 2 âm lịch hằng năm. Con cháu về đông đủ, mang theo:

- hương, hoa, trầu cau
- gạo, thịt, rượu
- ảnh gia đình: ![Nhà thờ họ](media:4)

Xem thêm [trang gia phả](https://example.com/gia-pha) hoặc liên hệ [ông Tư](mailto:tu@example.com).

Ghi chú: giá vé xe khoảng 2*3 = 6 chục nghìn; tệp \`so_do.pdf\` ở nhà ông Năm; mục [1] trong sổ cũ.`,
  'hanh-trang': `# Hành trạng cụ Nguyễn Văn B

### Tuổi trẻ

Cụ sinh năm 1850, mất năm 1920. Thuở nhỏ học chữ Nho, sau làm thầy đồ.

### Công đức

- Mở lớp dạy chữ cho trẻ trong làng
- Đứng ra xây lại **nhà thờ họ** sau trận bão năm 1897
- Quyên góp ruộng hương hỏa

> Cụ thường dặn: _"Làm người phải có trước có sau."_

![Chân dung cụ](media:11)

Đoạn cuối: cụ để lại bài thơ

Ngày xuân con én đưa thoi,
Thiều quang chín chục đã ngoài sáu mươi.

Hết.`,
};
