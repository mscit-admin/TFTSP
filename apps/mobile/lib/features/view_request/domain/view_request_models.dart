/// Public (non-member) view-request models — mirror `visibility.ts`.
library;

/// `CreateViewRequestDto` — submitted without auth, tenant via slug.
class CreateViewRequest {
  const CreateViewRequest({
    required this.tenantSlug,
    required this.fullName,
    required this.phone,
    required this.reason,
    this.allegedBranch,
    this.idAttachmentKey,
  });

  final String tenantSlug;
  final String fullName;
  final String phone;
  final String reason;
  final String? allegedBranch;
  final String? idAttachmentKey;

  Map<String, dynamic> toJson() => {
        'tenantSlug': tenantSlug,
        'fullName': fullName,
        'phone': phone,
        'reason': reason,
        if (allegedBranch != null && allegedBranch!.isNotEmpty)
          'allegedBranch': allegedBranch,
        if (idAttachmentKey != null) 'idAttachmentKey': idAttachmentKey,
      };
}
