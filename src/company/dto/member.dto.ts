import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyRole } from '../../schemas/company.schema';

class BaseMemberDto {
  @ApiProperty({ example: 'Priya Sharma' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ description: 'Login email. Required to set a password.' })
  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email' })
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Login password; the person is asked to change it' })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Overrides the company floor for this person' })
  @IsOptional()
  @IsString()
  workFloor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workUnit?: string;

  @ApiPropertyOptional({ default: true, description: 'Issue a gate pass straight away' })
  @IsOptional()
  @IsBoolean()
  issuePass?: boolean;
}

/** Admin side: the company's first accounts — owner or HR. */
export class CreateCompanyMemberDto extends BaseMemberDto {
  @ApiProperty({ enum: CompanyRole, example: CompanyRole.BOSS })
  @IsEnum(CompanyRole, { message: 'Role must be boss, hr or employee' })
  companyRole: CompanyRole;
}

/** App side: HR adds an employee. Role defaults to employee. */
export class CreateEmployeeDto extends BaseMemberDto {
  @ApiPropertyOptional({ enum: CompanyRole, default: CompanyRole.EMPLOYEE })
  @IsOptional()
  @IsEnum(CompanyRole, { message: 'Role must be boss, hr or employee' })
  companyRole?: CompanyRole = CompanyRole.EMPLOYEE;
}

export class SetMemberPasswordDto {
  @ApiPropertyOptional({ description: 'Set or change the login email at the same time' })
  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email' })
  email?: string;

  @ApiProperty()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}
