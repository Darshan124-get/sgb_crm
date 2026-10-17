import 'package:flutter/material.dart';

class LeadFilterChips extends StatelessWidget {
  final String selectedFilter;
  final ValueChanged<String> onFilterSelected;
  final VoidCallback? onMoreTap;
  final List<String>? dynamicFilters;

  const LeadFilterChips({
    super.key,
    required this.selectedFilter,
    required this.onFilterSelected,
    this.onMoreTap,
    this.dynamicFilters,
  });

  static const List<String> defaultFilters = [
    'Today (32)',
    'New (48)',
    'All (125)',
    'Follow-up (36)',
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Row(
        children: [
          ...(dynamicFilters ?? defaultFilters).map((filter) {
            final isSelected = selectedFilter.toLowerCase() == filter.toLowerCase();

            return Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: GestureDetector(
                onTap: () => onFilterSelected(filter),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOutCubic,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16.0,
                    vertical: 9.0,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? const Color(0xFF0A5844)
                        : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: isSelected
                        ? [
                            BoxShadow(
                              color: const Color(0xFF0A5844).withValues(alpha: 0.25),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Text(
                    filter,
                    style: TextStyle(
                      color: isSelected ? Colors.white : const Color(0xFF475569),
                      fontSize: 13,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ),
              ),
            );
          }),

          // 'More v' Dropdown Pill
          Builder(
            builder: (context) {
              final filtersList = dynamicFilters ?? defaultFilters;
              final isStandardSelected = filtersList.any(
                (f) => f.toLowerCase() == selectedFilter.toLowerCase(),
              );
              final isMoreSelected = !isStandardSelected && selectedFilter.isNotEmpty;

              return GestureDetector(
                onTap: onMoreTap,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOutCubic,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14.0,
                    vertical: 9.0,
                  ),
                  decoration: BoxDecoration(
                    color: isMoreSelected
                        ? const Color(0xFF0A5844)
                        : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: isMoreSelected
                        ? [
                            BoxShadow(
                              color: const Color(0xFF0A5844).withValues(alpha: 0.25),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        isMoreSelected ? selectedFilter : 'More',
                        style: TextStyle(
                          color: isMoreSelected ? Colors.white : const Color(0xFF475569),
                          fontSize: 13,
                          fontWeight: isMoreSelected ? FontWeight.w700 : FontWeight.w500,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: 16,
                        color: isMoreSelected ? Colors.white : const Color(0xFF475569),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
