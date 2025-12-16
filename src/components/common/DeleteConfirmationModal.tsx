
import { ConfirmationModal } from './ConfirmationModal'

interface DeleteConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message?: string
  isDeleting?: boolean
  deleteLabel?: string
  cancelLabel?: string
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Delete Item',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  isDeleting = false,
  deleteLabel = 'Delete',
  cancelLabel = 'Cancel',
}: DeleteConfirmationModalProps) {
  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      message={message}
      isConfirming={isDeleting}
      confirmLabel={deleteLabel}
      cancelLabel={cancelLabel}
      variant="danger"
    />
  )
}
