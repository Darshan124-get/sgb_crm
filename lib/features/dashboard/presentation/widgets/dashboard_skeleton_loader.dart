import 'package:flutter/material.dart';
import '../../../../core/widgets/shimmer_loading.dart';

class DashboardSkeletonLoader extends StatelessWidget {
  const DashboardSkeletonLoader({super.key});

  @override
  Widget build(BuildContext context) {
    return ShimmerLoadingScope(
      child: SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Shimmering Dark Green Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 52, 20, 24),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF0A5844),
                    Color(0xFF064736),
                    Color(0xFF033326),
                  ],
                ),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(28),
                  bottomRight: Radius.circular(28),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top row: Greeting + Avatar
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          ShimmerBox.dark(width: 110, height: 14, borderRadius: 5),
                          SizedBox(height: 8),
                          ShimmerBox.dark(width: 160, height: 26, borderRadius: 8),
                          SizedBox(height: 6),
                          ShimmerBox.dark(width: 190, height: 12, borderRadius: 4),
                        ],
                      ),
                      const ShimmerBox.darkCircle(size: 46),
                    ],
                  ),
                  const SizedBox(height: 20),
                  // Date Pill & Timeframe Chips
                  Row(
                    children: const [
                      ShimmerBox.dark(width: 140, height: 34, borderRadius: 17),
                      SizedBox(width: 12),
                      ShimmerBox.dark(width: 60, height: 34, borderRadius: 17),
                      SizedBox(width: 8),
                      ShimmerBox.dark(width: 70, height: 34, borderRadius: 17),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // 2. Primary KPI Grid Skeleton (2x2)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: GridView.count(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.45,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                children: List.generate(4, (_) => _buildKpiCardSkeleton()),
              ),
            ),

            const SizedBox(height: 16),

            // 3. Secondary Metrics Row Skeleton (Horizontal scroll)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Row(
                children: List.generate(
                  3,
                  (i) => Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(right: i < 2 ? 8.0 : 0),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFF1F5F9)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            ShimmerBox.circle(size: 28),
                            SizedBox(height: 10),
                            ShimmerBox(width: 50, height: 18, borderRadius: 6),
                            SizedBox(height: 6),
                            ShimmerBox(width: 70, height: 10, borderRadius: 4),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 16),

            // 4. Chart Skeleton Card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFF1F5F9)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        ShimmerBox(width: 140, height: 16, borderRadius: 6),
                        ShimmerBox(width: 120, height: 28, borderRadius: 14),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: const [
                        ShimmerBox(width: 22, height: 90, borderRadius: 6),
                        ShimmerBox(width: 22, height: 140, borderRadius: 6),
                        ShimmerBox(width: 22, height: 80, borderRadius: 6),
                        ShimmerBox(width: 22, height: 160, borderRadius: 6),
                        ShimmerBox(width: 22, height: 110, borderRadius: 6),
                        ShimmerBox(width: 22, height: 130, borderRadius: 6),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiCardSkeleton() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              ShimmerBox.circle(size: 34),
              ShimmerBox(width: 42, height: 16, borderRadius: 8),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              ShimmerBox(width: 65, height: 22, borderRadius: 6),
              SizedBox(height: 6),
              ShimmerBox(width: 90, height: 11, borderRadius: 4),
            ],
          ),
        ],
      ),
    );
  }
}
