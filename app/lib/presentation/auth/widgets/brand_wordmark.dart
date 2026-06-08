import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

/// BrainWave brand lockup — a primary-filled mark + Space Grotesk wordmark.
class BrandWordmark extends StatelessWidget {
  final bool showTagline;
  final double size;

  const BrandWordmark({super.key, this.showTagline = true, this.size = 48});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: p.primary,
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Icon(Icons.auto_stories_rounded,
              color: p.primaryForeground, size: size * 0.55),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('BrainWave', style: context.texts.headlineSmall),
            if (showTagline)
              Text('NCERT AI Learning',
                  style: context.texts.bodySmall
                      ?.copyWith(color: p.mutedForeground)),
          ],
        ),
      ],
    );
  }
}
