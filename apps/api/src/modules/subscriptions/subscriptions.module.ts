import { Global, Module } from '@nestjs/common';
import { PlanLimitService } from './plan-limit.service';
import { ManualPaymentGateway, PaymentGateway } from './payment-gateway';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionRepository } from './subscription.repository';
import { SubscriptionService } from './subscription.service';

/** Global so the plan-cap guard is injectable wherever persons are created. */
@Global()
@Module({
  controllers: [SubscriptionController],
  providers: [
    SubscriptionRepository,
    SubscriptionService,
    PlanLimitService,
    { provide: PaymentGateway, useClass: ManualPaymentGateway },
  ],
  exports: [PlanLimitService, SubscriptionRepository, SubscriptionService],
})
export class SubscriptionsModule {}
