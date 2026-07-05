import 'dart:async';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// Offline read cache (sqlite via sqflite; no codegen).
///
/// A single tenant-scoped key/value table stores the last fetched tree and any
/// opened person cards as JSON strings. Writes to the *domain* are never cached
/// here — this is strictly a read cache to support offline browsing.
class CacheDatabase {
  CacheDatabase({Database? database}) : _injected = database;

  final Database? _injected;
  Database? _db;

  static const _dbName = 'tftsp_cache.db';
  static const _table = 'cache_entries';

  Future<Database> _open() async {
    if (_injected != null) return _injected;
    final existing = _db;
    if (existing != null) return existing;

    final dir = await getDatabasesPath();
    final path = p.join(dir, _dbName);
    final db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE $_table (
            scope TEXT NOT NULL,
            cache_key TEXT NOT NULL,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (scope, cache_key)
          )
        ''');
      },
    );
    _db = db;
    return db;
  }

  /// Upsert a JSON payload under (tenant scope, key).
  Future<void> put({
    required String scope,
    required String key,
    required String jsonValue,
  }) async {
    final db = await _open();
    await db.insert(
      _table,
      {
        'scope': scope,
        'cache_key': key,
        'value': jsonValue,
        'updated_at': DateTime.now().millisecondsSinceEpoch,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Read a cached JSON payload, or null when absent.
  Future<String?> get({required String scope, required String key}) async {
    final db = await _open();
    final rows = await db.query(
      _table,
      columns: ['value'],
      where: 'scope = ? AND cache_key = ?',
      whereArgs: [scope, key],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return rows.first['value'] as String?;
  }

  /// Drop every entry for a tenant — used when switching the active tribe so no
  /// data from the inactive tribe can surface.
  Future<void> clearScope(String scope) async {
    final db = await _open();
    await db.delete(_table, where: 'scope = ?', whereArgs: [scope]);
  }

  Future<void> close() async {
    await _db?.close();
    _db = null;
  }
}

/// Well-known cache keys.
class CacheKeys {
  const CacheKeys._();

  static String tree(String? rootId, int generations) =>
      'tree:${rootId ?? 'roots'}:$generations';

  static String person(String id) => 'person:$id';
}
