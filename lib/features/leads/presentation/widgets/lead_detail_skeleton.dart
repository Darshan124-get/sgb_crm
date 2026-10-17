import 'package:flutter/material.dart';
import '../../../../core/widgets/shimmer_loading.dart';

class LeadDetailSkeleton extends StatelessWidget {
  const LeadDetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ShimmerLoadingScope(
      child: SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Profile Card Skeleton
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      const ShimmerBox.circle(size: 56),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            ShimmerBox(width: 150, height: 18, borderRadius: 6),
                            SizedBox(height: 8),
                            ShimmerBox(width: 120, height: 13, borderRadius: 5),
                            SizedBox(height: 6),
                            ShimmerBox(width: 90, height: 12, borderRadius: 4),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  const Divider(height: 1, color: Color(0xFFF1F5F9)),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: const [
                      ShimmerBox(width: 60, height: 32, borderRadius: 16),
                      ShimmerBox(width: 60, height: 32, borderRadius: 16),
                      ShimmerBox(width: 60, height: 32, borderRadius: 16),
                      ShimmerBox(width: 60, height: 32, borderRadius: 16),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 2. Tabs Bar Skeleton
            Row(
              children: const [
                Expanded(child: ShimmerBox(width: double.infinity, height: 42, borderRadius: 12)),
                SizedBox(width: 10),
                Expanded(child: ShimmerBox(width: double.infinity, height: 42, borderRadius: 12)),
              ],
            ),

            const SizedBox(height: 16),

            // 3. Info Cards Skeleton
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFF1F5F9)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  ShimmerBox(width: 120, height: 15, borderRadius: 5),
                  SizedBox(height: 14),
                  ShimmerBox(width: double.infinity, height: 13, borderRadius: 4),
                  SizedBox(height: 8),
                  ShimmerBox(width: 220, height: 13, borderRadius: 4),
                  SizedBox(height: 8),
                  ShimmerBox(width: 180, height: 13, borderRadius: 4),
                ],
              ),
            ),

            const SizedBox(height: 16),

            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFF1F5F9)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  ShimmerBox(width: 140, height: 15, borderRadius: 5),
                  SizedBox(height: 14),
                  ShimmerBox(width: double.infinity, height: 40, borderRadius: 8),
                  SizedBox(height: 10),
                  ShimmerBox(width: double.infinity, height: 40, borderRadius: 8),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
