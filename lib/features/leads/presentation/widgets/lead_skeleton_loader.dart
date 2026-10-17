import 'package:flutter/material.dart';
import '../../../../core/widgets/shimmer_loading.dart';
export '../../../../core/widgets/shimmer_loading.dart';

class LeadSkeletonCard extends StatelessWidget {
  const LeadSkeletonCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Shimmering Avatar Circle
              const ShimmerBox.circle(size: 46),

              const SizedBox(width: 14),

              // 2. Shimmering Lead Info (Name, Phone, City)
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const ShimmerBox(width: 135, height: 15, borderRadius: 6),
                    const SizedBox(height: 7),
                    const ShimmerBox(width: 105, height: 12, borderRadius: 5),
                    const SizedBox(height: 6),
                    const ShimmerBox(width: 90, height: 11, borderRadius: 5),
                  ],
                ),
              ),

              const SizedBox(width: 10),

              // 3. Shimmering Timestamp & Status Badge
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: const [
                  ShimmerBox(width: 52, height: 11, borderRadius: 5),
                  SizedBox(height: 10),
                  ShimmerBox(width: 66, height: 22, borderRadius: 8),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
        ],
      ),
    );
  }
}

class LeadSkeletonList extends StatelessWidget {
  final int count;

  const LeadSkeletonList({super.key, this.count = 6});

  @override
  Widget build(BuildContext context) {
    return ShimmerLoadingScope(
      child: ListView.builder(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        itemCount: count,
        itemBuilder: (context, index) => const LeadSkeletonCard(),
      ),
    );
  }
}
