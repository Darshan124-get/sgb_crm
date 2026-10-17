import 'package:flutter/material.dart';
import '../../../../core/widgets/shimmer_loading.dart';

class WhatsAppSkeletonCard extends StatelessWidget {
  const WhatsAppSkeletonCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Avatar circle
          const ShimmerBox.circle(size: 48),

          const SizedBox(width: 14),

          // Name, preview message, tags
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                ShimmerBox(width: 140, height: 15, borderRadius: 5),
                SizedBox(height: 7),
                ShimmerBox(width: 180, height: 12, borderRadius: 4),
                SizedBox(height: 6),
                ShimmerBox(width: 110, height: 10, borderRadius: 4),
              ],
            ),
          ),

          const SizedBox(width: 10),

          // Time and status badge
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: const [
              ShimmerBox(width: 50, height: 11, borderRadius: 4),
              SizedBox(height: 10),
              ShimmerBox(width: 22, height: 22, borderRadius: 11),
            ],
          ),
        ],
      ),
    );
  }
}

class WhatsAppSkeletonList extends StatelessWidget {
  final int count;

  const WhatsAppSkeletonList({super.key, this.count = 7});

  @override
  Widget build(BuildContext context) {
    return ShimmerLoadingScope(
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        itemCount: count,
        separatorBuilder: (_, __) => const Divider(
          height: 1,
          indent: 78,
          endIndent: 16,
          color: Color(0xFFF1F5F9),
        ),
        itemBuilder: (context, index) => const WhatsAppSkeletonCard(),
      ),
    );
  }
}
