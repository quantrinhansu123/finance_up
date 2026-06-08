-- Bucket lưu ảnh hóa đơn / chứng từ khi không dùng Cloudinary.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finance-bills',
  'finance-bills',
  true,
  33554432,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
