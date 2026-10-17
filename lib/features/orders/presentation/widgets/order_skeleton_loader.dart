import 'package:flutter/material.dart';
import '../../../../core/widgets/shimmer_loading.dart';

class OrderSkeletonCard extends StatelessWidget {
  const OrderSkeletonCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
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
        children: [
          // Order ID + Status Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              ShimmerBox(width: 120, height: 16, borderRadius: 6),
              ShimmerBox(width: 75, height: 24, borderRadius: 8),
            ],
          ),

          const SizedBox(height: 12),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 12),

          // Customer details
          Row(
            children: [
              const ShimmerBox.circle(size: 38),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    ShimmerBox(width: 130, height: 14, borderRadius: 5),
                    SizedBox(height: 6),
                    ShimmerBox(width: 170, height: 11, borderRadius: 4),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Amount + Items row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              ShimmerBox(width: 90, height: 18, borderRadius: 6),
              ShimmerBox(width: 65, height: 12, borderRadius: 4),
            ],
          ),
        ],
      ),
    );
  }
}

class OrderSkeletonList extends StatelessWidget {
  final int count;

  const OrderSkeletonList({super.key, this.count = 5});

  @override
  Widget build(BuildContext context) {
    return ShimmerLoadingScope(
      child: ListView.builder(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        itemCount: count,
        itemBuilder: (context, index) => const OrderSkeletonCard(),
      ),
    );
  }
}
