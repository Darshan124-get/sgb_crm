import 'package:flutter_test/flutter_test.dart';
import 'package:sgbconnect/features/leads/data/lead_service.dart';
import 'package:sgbconnect/features/leads/domain/models/lead_model.dart';

void main() {
  group('Leads Pagination and Stats Tests', () {
    test('LeadPaginationResult correctly holds metadata and counts', () {
      final sampleLeads = LeadModel.sampleLeads();
      final result = LeadPaginationResult(
        leads: sampleLeads,
        totalLeads: 185,
        totalPages: 4,
        currentPage: 1,
        counts: {
          'all': 185,
          'today': 42,
          'new': 75,
          'followup': 38,
          'hot': 25,
          'lost': 12,
          'open': 160,
          'converted': 13,
        },
      );

      expect(result.leads.length, 8);
      expect(result.totalLeads, 185);
      expect(result.totalPages, 4);
      expect(result.currentPage, 1);
      expect(result.counts['all'], 185);
      expect(result.counts['new'], 75);
      expect(result.counts['today'], 42);
      expect(result.counts['followup'], 38);
    });

    test('LeadPaginationResult defaults safely with empty responses', () {
      const result = LeadPaginationResult(
        leads: [],
        totalLeads: 0,
        totalPages: 1,
        currentPage: 1,
      );

      expect(result.leads, isEmpty);
      expect(result.totalLeads, 0);
      expect(result.counts, isEmpty);
    });
  });
}
