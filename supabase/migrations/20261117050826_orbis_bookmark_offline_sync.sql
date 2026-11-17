-- Allow offline bookmark changes to use the idempotent sync outbox.
ALTER TABLE public.orbis_sync_operations
  DROP CONSTRAINT IF EXISTS orbis_sync_operations_operation_type_check;

ALTER TABLE public.orbis_sync_operations
  ADD CONSTRAINT orbis_sync_operations_operation_type_check
  CHECK (operation_type IN (
    'post.create',
    'like.set',
    'comment.create',
    'follow.set',
    'profile.update',
    'bookmark.set'
  ));
