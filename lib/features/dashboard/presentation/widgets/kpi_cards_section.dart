import 'package:flutter/material.dart';
import '../../domain/models/dashboard_data.dart';

class KpiCardsSection extends StatelessWidget {
  final List<KpiItem> primaryKpis;
  final List<KpiItem> secondaryKpis;
  final void Function(KpiItem)? onKpiTap;

  const KpiCardsSection({
    super.key,
    required this.primaryKpis,
    required this.secondaryKpis,
    this.onKpiTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Row 1: Primary Metrics (Total Leads, Called, Connected, Missed)
        _buildKpiRow(
          items: primaryKpis,
          minCardWidth: 92,
        ),

        const SizedBox(height: 12),

        // Row 2: Secondary Metrics (Sold Orders, Sold Value, Units Sold, Converted, Lost)
        _buildKpiRow(
          items: secondaryKpis,
          minCardWidth: 84,
        ),
      ],
    );
  }

  Widget _buildKpiRow({
    required List<KpiItem> items,
    required double minCardWidth,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final totalSpacing = (items.length - 1) * 8.0;
        final availableWidth = constraints.maxWidth;
        final fitWidth = (availableWidth - totalSpacing) / items.length;

        // If fits well on screen, display in equal-width flex row, otherwise scroll smoothly
        if (fitWidth >= minCardWidth) {
          return Row(
            children: items.map((item) {
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                    right: item == items.last ? 0 : 8.0,
                  ),
                  child: _KpiCard(
                    item: item,
                    onTap: () => onKpiTap?.call(item),
                  ),
                ),
              );
            }).toList(),
          );
        } else {
          return SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: items.map((item) {
                return Container(
                  width: minCardWidth + 8,
                  margin: EdgeInsets.only(
                    right: item == items.last ? 0 : 8.0,
                  ),
                  child: _KpiCard(
                    item: item,
                    onTap: () => onKpiTap?.call(item),
                  ),
                );
              }).toList(),
            ),
          );
        }
      },
    );
  }
}

class _KpiCard extends StatelessWidget {
  final KpiItem item;
  final VoidCallback? onTap;

  const _KpiCard({
    required this.item,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isNegative = !item.isTrendPositive;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      elevation: 0,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        splashColor: item.iconColor.withValues(alpha: 0.1),
        highlightColor: item.iconColor.withValues(alpha: 0.05),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 10.0),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: const Color(0xFFF1F5F9),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.035),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Icon Circle with optional Hot badge
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: item.iconBgColor,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Icon(
                        item.icon,
                        color: item.iconColor,
                        size: 15,
                      ),
                    ),
                  ),
                  if (item.isHot)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFE4E6),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'Hot',
                        style: TextStyle(
                          color: Color(0xFFE11D48),
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                ],
              ),

              const SizedBox(height: 6),

              // Metric Value with smooth animated transitions
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  transitionBuilder: (child, animation) {
                    return FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: Tween<Offset>(
                          begin: const Offset(0.0, 0.2),
                          end: Offset.zero,
                        ).animate(animation),
                        child: child,
                      ),
                    );
                  },
                  child: Text(
                    item.value,
                    key: ValueKey<String>('${item.label}_${item.value}'),
                    style: const TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 16.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 1),

              // Metric Label
              Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFF64748B),
                  fontSize: 10.5,
                  fontWeight: FontWeight.w500,
                ),
              ),

              const SizedBox(height: 4),

              // Trend Percentage + Chevron
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Text(
                      item.trend,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isNegative
                            ? const Color(0xFFEF4444)
                            : const Color(0xFF10B981),
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 13,
                    color: Color(0xFF94A3B8),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
