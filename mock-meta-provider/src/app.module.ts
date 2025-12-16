import { Module } from '@nestjs/common';
import { ProviderController } from './provider/provider.controller';
import { ProviderService } from './provider/provider.service';

@Module({
  imports: [],
  controllers: [ProviderController],
  providers: [ProviderService],
})
export class AppModule {}
