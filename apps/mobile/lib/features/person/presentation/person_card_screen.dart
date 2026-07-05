import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tftsp_mobile/core/widgets/offline_badge.dart';
import 'package:tftsp_mobile/features/person/data/person_repository.dart';
import 'package:tftsp_mobile/features/person/domain/person_models.dart';
import 'package:tftsp_mobile/features/person/presentation/person_controller.dart';

class PersonCardScreen extends ConsumerWidget {
  const PersonCardScreen({required this.personId, super.key});

  final String personId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(personCardProvider(personId));
    return Scaffold(
      appBar: AppBar(title: Text('person.title'.tr())),
      body: Column(
        children: [
          const OfflineBadge(),
          Expanded(
            child: async.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('common.unknownError'.tr()),
                    const SizedBox(height: 8),
                    FilledButton(
                      onPressed: () =>
                          ref.invalidate(personCardProvider(personId)),
                      child: Text('common.retry'.tr()),
                    ),
                  ],
                ),
              ),
              data: (card) => _CardBody(card: card),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () =>
            unawaited(context.push('/contributions/new?personId=$personId')),
        icon: const Icon(Icons.edit_outlined),
        label: Text('person.createChangeRequest'.tr()),
      ),
    );
  }
}

class _CardBody extends StatelessWidget {
  const _CardBody({required this.card});

  final PersonCard card;

  @override
  Widget build(BuildContext context) {
    final p = card.person;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (card.fromCache)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              'common.offlineBadge'.tr(),
              style: TextStyle(color: Theme.of(context).colorScheme.tertiary),
            ),
          ),
        Center(
          child: CircleAvatar(
            radius: 56,
            backgroundImage: (p.photoUrl != null && p.photoUrl!.isNotEmpty)
                ? CachedNetworkImageProvider(p.photoUrl!)
                : null,
            child: (p.photoUrl == null || p.photoUrl!.isEmpty)
                ? const Icon(Icons.person, size: 56)
                : null,
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: Text(
            p.fullName,
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 16),
        // Only fields the Visibility Resolver returned are present.
        _field(context, 'person.laqab', p.laqab),
        _field(context, 'person.profession', p.profession),
        _field(context, 'person.gender',
            p.gender == 'female' ? 'person.female'.tr() : 'person.male'.tr()),
        _field(context, 'person.born', p.birthDate),
        _field(context, 'person.birthPlace', p.birthPlace),
        if (p.isDeceased) _field(context, 'person.died', p.deathDate),
        if (p.isDeceased)
          _field(context, 'person.deathPlace', p.deathPlace),
        if (p.biography != null && p.biography!.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(p.biography!),
        ],
        const SizedBox(height: 20),
        if (card.lineage.isNotEmpty) ...[
          Text('person.lineage'.tr(),
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            children: [
              for (final entry in card.lineage)
                Chip(label: Text(entry.name)),
            ],
          ),
          const SizedBox(height: 20),
        ],
        Text('person.documents'.tr(),
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (card.documents.isEmpty)
          Text('person.noDocuments'.tr())
        else
          ...card.documents.map(_DocumentTile.new),
      ],
    );
  }

  Widget _field(BuildContext context, String labelKey, String? value) {
    if (value == null || value.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              labelKey.tr(),
              style: TextStyle(
                color: Theme.of(context).colorScheme.outline,
              ),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

class _DocumentTile extends StatelessWidget {
  const _DocumentTile(this.doc);

  final PersonDocument doc;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(doc.isImage ? Icons.image_outlined : Icons.picture_as_pdf),
      title: Text(doc.filename),
      subtitle: doc.isImage && doc.downloadUrl.isNotEmpty
          ? ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: CachedNetworkImage(
                imageUrl: doc.downloadUrl,
                height: 120,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) =>
                    const Icon(Icons.broken_image_outlined),
              ),
            )
          : null,
    );
  }
}
