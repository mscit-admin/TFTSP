/// Change-request + reputation domain models — mirror `change-request.ts` and
/// `reputation.ts`.
library;

/// Contribution types a member may pick (reputation.ts). Kept as string keys.
enum ContributionType {
  addPerson('add_person'),
  editData('edit_data'),
  fixRelation('fix_relation'),
  uploadDocument('upload_document'),
  addSource('add_source'),
  addBiography('add_biography');

  const ContributionType(this.wire);

  /// Value sent to / received from the backend.
  final String wire;

  /// easy_localization key for the label.
  String get labelKey => switch (this) {
        ContributionType.addPerson => 'contributions.typeAddPerson',
        ContributionType.editData => 'contributions.typeEditData',
        ContributionType.fixRelation => 'contributions.typeFixRelation',
        ContributionType.uploadDocument => 'contributions.typeUploadDocument',
        ContributionType.addSource => 'contributions.typeAddSource',
        ContributionType.addBiography => 'contributions.typeAddBiography',
      };

  static ContributionType? fromWire(String? wire) {
    for (final t in ContributionType.values) {
      if (t.wire == wire) return t;
    }
    return null;
  }
}

/// One RFC-6902 patch operation.
class JsonPatchOp {
  const JsonPatchOp({required this.op, required this.path, this.value});

  /// 'add' | 'remove' | 'replace'
  final String op;
  final String path;
  final Object? value;

  Map<String, dynamic> toJson() => {
        'op': op,
        'path': path,
        if (op != 'remove') 'value': value,
      };
}

class ChangeRequestReview {
  const ChangeRequestReview({
    required this.decision,
    required this.createdAt,
    this.comment,
  });

  final String decision;
  final String createdAt;
  final String? comment;

  factory ChangeRequestReview.fromJson(Map<String, dynamic> json) =>
      ChangeRequestReview(
        decision: json['decision'] as String? ?? '',
        createdAt: json['createdAt'] as String? ?? '',
        comment: json['comment'] as String?,
      );
}

class ChangeRequest {
  const ChangeRequest({
    required this.id,
    required this.targetType,
    required this.operation,
    required this.status,
    required this.createdAt,
    this.targetId,
    this.contributionType,
    this.reviews = const [],
    this.expiresAt,
  });

  final String id;

  /// 'person' | 'union' | 'tribal_unit'
  final String targetType;

  /// 'create' | 'update' | 'delete'
  final String operation;
  final String status;
  final String createdAt;
  final String? targetId;
  final ContributionType? contributionType;
  final List<ChangeRequestReview> reviews;
  final String? expiresAt;

  factory ChangeRequest.fromJson(Map<String, dynamic> json) => ChangeRequest(
        id: json['id'] as String,
        targetType: json['targetType'] as String? ?? 'person',
        operation: json['operation'] as String? ?? 'update',
        status: json['status'] as String? ?? 'draft',
        createdAt: json['createdAt'] as String? ?? '',
        targetId: json['targetId'] as String?,
        contributionType:
            ContributionType.fromWire(json['contributionType'] as String?),
        reviews: (json['reviews'] as List<dynamic>? ?? const [])
            .map((e) =>
                ChangeRequestReview.fromJson(e as Map<String, dynamic>))
            .toList(),
        expiresAt: json['expiresAt'] as String?,
      );

  /// easy_localization key for the status chip.
  String get statusKey => switch (status) {
        'draft' => 'contributions.statusDraft',
        'submitted' => 'contributions.statusSubmitted',
        'under_review' => 'contributions.statusUnderReview',
        'approved' => 'contributions.statusApproved',
        'rejected' => 'contributions.statusRejected',
        'changes_requested' => 'contributions.statusChangesRequested',
        'published' => 'contributions.statusPublished',
        'conflict' => 'contributions.statusConflict',
        'expired' => 'contributions.statusExpired',
        _ => 'contributions.statusSubmitted',
      };
}

/// Payload for `POST /change-requests` (with the M4 `contributionType`).
class CreateChangeRequest {
  const CreateChangeRequest({
    required this.targetType,
    required this.operation,
    required this.patch,
    this.targetId,
    this.contributionType,
  });

  final String targetType;
  final String operation;
  final List<JsonPatchOp> patch;
  final String? targetId;
  final ContributionType? contributionType;

  Map<String, dynamic> toJson() => {
        'targetType': targetType,
        'operation': operation,
        'patch': patch.map((p) => p.toJson()).toList(),
        if (targetId != null) 'targetId': targetId,
        if (contributionType != null)
          'contributionType': contributionType!.wire,
      };
}

/// `ContributorReputation` (reputation.ts).
class ContributorReputation {
  const ContributorReputation({
    required this.totalContributions,
    required this.accepted,
    required this.rejected,
    required this.accuracyRate,
    required this.trustLevel,
  });

  final int totalContributions;
  final int accepted;
  final int rejected;
  final double accuracyRate;

  /// 'bronze' | 'silver' | 'gold'
  final String trustLevel;

  factory ContributorReputation.fromJson(Map<String, dynamic> json) =>
      ContributorReputation(
        totalContributions: json['totalContributions'] as int? ?? 0,
        accepted: json['accepted'] as int? ?? 0,
        rejected: json['rejected'] as int? ?? 0,
        accuracyRate: (json['accuracyRate'] as num? ?? 0).toDouble(),
        trustLevel: json['trustLevel'] as String? ?? 'bronze',
      );

  String get trustLevelKey => switch (trustLevel) {
        'gold' => 'reputation.gold',
        'silver' => 'reputation.silver',
        _ => 'reputation.bronze',
      };
}
